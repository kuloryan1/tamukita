import "dotenv/config";

import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaPg } from "@prisma/adapter-pg";
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { PrismaClient } from "./generated/prisma/client";
import { isReservedNonDeliverableEmailAddress } from "./lib/email-address";
import { getTransactionalEmailEndpoint } from "./lib/email-transport";
import { getR2BucketNames } from "./lib/r2-buckets";
import { getWorkerIntegrationConfigurations } from "./lib/integration-status";
import { runDataRetentionSweep } from "./lib/data-retention";
import {
  createWorkerIntegrationSnapshot,
  WORKER_CONFIGURATION_KEY,
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SECONDS,
  WORKER_HEARTBEAT_VALUE,
} from "./lib/worker-health";
import {
  failMediaEdit,
  failMediaProcessing,
  InvalidMediaAssetError,
  parseMediaEditProcessingPayload,
  parseMediaProcessingPayload,
  processMediaEdit,
  processMediaAsset,
  type MediaProcessingConfig,
} from "./lib/media-processing";

const queueName = "tamukita-notifications";
const DATA_RETENTION_LOCK_KEY = "tamukita:data-retention:sweep";
const DATA_RETENTION_LOCK_TTL_SECONDS = 21_600;
const DATA_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const REFRESH_DATA_RETENTION_LOCK_SCRIPT = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('expire', KEYS[1], ARGV[2]) else return 0 end";
const RELEASE_DATA_RETENTION_LOCK_SCRIPT = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
const redisUrl = process.env.REDIS_URL;
const databaseUrl = process.env.DATABASE_URL;
if (!redisUrl) throw new Error("REDIS_URL diperlukan untuk worker notifikasi.");
if (!databaseUrl) throw new Error("DATABASE_URL diperlukan untuk worker notifikasi.");

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const queue = new Queue(queueName, { connection });
const mediaBuckets = getR2BucketNames(process.env);
const mediaConfig: MediaProcessingConfig | null = mediaBuckets && process.env.R2_PUBLIC_BASE_URL
  ? { ...mediaBuckets, publicBaseUrl: process.env.R2_PUBLIC_BASE_URL, allowLocalHttpPublicBaseUrl: process.env.E2E_R2_MOCK === "true" }
  : null;
const mediaS3 = mediaConfig && process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
  ? new S3Client({
      region: "auto",
      endpoint: process.env.R2_S3_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      forcePathStyle: Boolean(process.env.R2_S3_ENDPOINT),
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    })
  : null;

type NotificationPayload = {
  to: string;
  name: string;
  orderId: string;
  amountIdr: number;
  currency: "IDR";
  itemLabel: string;
  dashboardPath: "/dashboard" | "/reseller" | `/dashboard/invitations/${string}/edit`;
};

type ResellerStaffPayload = { to: string; name: string; resellerName: string; dashboardPath: "/reseller" };
type ResellerCustomerAccessPayload = { to: string; name: string; resellerName: string; customerName: string; decision: "APPROVED" | "DECLINED" | "REVOKED"; dashboardPath: "/reseller" };
type AdminManagedInvitationPayload = { to: string; name: string; invitationId: string; invitationTitle: string };
type RsvpReceivedPayload = { to: string; ownerName: string; invitationId: string; invitationTitle: string; guestName: string; attendance: "ATTENDING" | "DECLINED"; attendeeCount: number };
type EventReminderPayload = { to: string; ownerName: string; invitationTitle: string; invitationSlug: string; eventTitle: string; startsAt: string; venue: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePayload(value: unknown): NotificationPayload | null {
  const isSafeDashboardPath = value !== null
    && typeof value === "object"
    && "dashboardPath" in value
    && (value.dashboardPath === "/dashboard"
      || value.dashboardPath === "/reseller"
      || (typeof value.dashboardPath === "string" && /^\/dashboard\/invitations\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/edit$/i.test(value.dashboardPath)));
  if (!isRecord(value)
    || typeof value.to !== "string"
    || !value.to.includes("@")
    || typeof value.orderId !== "string"
    || typeof value.itemLabel !== "string"
    || typeof value.name !== "string"
    || !Number.isSafeInteger(value.amountIdr)
    || value.currency !== "IDR"
    || !isSafeDashboardPath) return null;
  return {
    to: value.to,
    name: value.name,
    orderId: value.orderId,
    amountIdr: value.amountIdr as number,
    currency: "IDR",
    itemLabel: value.itemLabel,
    dashboardPath: value.dashboardPath as NotificationPayload["dashboardPath"],
  };
}

function parseResellerStaffPayload(value: unknown): ResellerStaffPayload | null {
  if (!isRecord(value) || typeof value.to !== "string" || !value.to.includes("@") || typeof value.name !== "string" || typeof value.resellerName !== "string" || value.dashboardPath !== "/reseller") return null;
  return { to: value.to, name: value.name, resellerName: value.resellerName, dashboardPath: "/reseller" };
}

function parseResellerCustomerAccessPayload(value: unknown): ResellerCustomerAccessPayload | null {
  if (!isRecord(value) || typeof value.to !== "string" || !value.to.includes("@") || typeof value.name !== "string" || typeof value.resellerName !== "string" || typeof value.customerName !== "string" || !["APPROVED", "DECLINED", "REVOKED"].includes(String(value.decision)) || value.dashboardPath !== "/reseller") return null;
  return { to: value.to, name: value.name, resellerName: value.resellerName, customerName: value.customerName, decision: value.decision as ResellerCustomerAccessPayload["decision"], dashboardPath: "/reseller" };
}

function parseAdminManagedInvitationPayload(value: unknown): AdminManagedInvitationPayload | null {
  if (!isRecord(value)
    || typeof value.to !== "string"
    || !value.to.includes("@")
    || typeof value.name !== "string"
    || typeof value.invitationId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.invitationId)
    || typeof value.invitationTitle !== "string") return null;
  return { to: value.to, name: value.name, invitationId: value.invitationId, invitationTitle: value.invitationTitle };
}

function parseRsvpReceivedPayload(value: unknown): RsvpReceivedPayload | null {
  if (!isRecord(value)
    || typeof value.to !== "string"
    || !value.to.includes("@")
    || typeof value.ownerName !== "string"
    || typeof value.invitationId !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.invitationId)
    || typeof value.invitationTitle !== "string"
    || typeof value.guestName !== "string"
    || (value.attendance !== "ATTENDING" && value.attendance !== "DECLINED")
    || !Number.isSafeInteger(value.attendeeCount)
    || Number(value.attendeeCount) < 1
    || Number(value.attendeeCount) > 10) return null;
  return {
    to: value.to,
    ownerName: value.ownerName,
    invitationId: value.invitationId,
    invitationTitle: value.invitationTitle,
    guestName: value.guestName,
    attendance: value.attendance,
    attendeeCount: Number(value.attendeeCount),
  };
}

function parseEventReminderPayload(value: unknown): EventReminderPayload | null {
  if (!isRecord(value)
    || typeof value.to !== "string"
    || !value.to.includes("@")
    || typeof value.ownerName !== "string"
    || typeof value.invitationTitle !== "string"
    || typeof value.invitationSlug !== "string"
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.invitationSlug)
    || typeof value.eventTitle !== "string"
    || typeof value.startsAt !== "string"
    || !Number.isFinite(Date.parse(value.startsAt))
    || typeof value.venue !== "string") return null;
  return {
    to: value.to,
    ownerName: value.ownerName,
    invitationTitle: value.invitationTitle,
    invitationSlug: value.invitationSlug,
    eventTitle: value.eventTitle,
    startsAt: value.startsAt,
    venue: value.venue,
  };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

async function sendPaymentEmail(payload: NotificationPayload) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = new URL(payload.dashboardPath, appUrl).toString();
  const greeting = payload.name ? `Halo ${payload.name},` : "Halo,";
  const amount = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(payload.amountIdr);
  const subject = "Pembayaran diterima · TamuKita";
  const text = `${greeting}\n\nPembayaran ${amount} untuk ${payload.itemLabel} telah dikonfirmasi. Referensi pesanan: ${payload.orderId}.\n\nBuka dashboard TamuKita untuk melanjutkan: ${link}\n\nTerima kasih telah menggunakan TamuKita.`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#35473b"><p>${escapeHtml(greeting)}</p><p>Pembayaran <b>${escapeHtml(amount)}</b> untuk <b>${escapeHtml(payload.itemLabel)}</b> telah dikonfirmasi.</p><p>Referensi pesanan: ${escapeHtml(payload.orderId)}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#35473b;color:#fff;padding:12px 18px;text-decoration:none">Buka dashboard TamuKita</a></p><p>Terima kasih telah menggunakan TamuKita.</p></div>`;
  await sendEmail(payload.to, subject, text, html);
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  if (isReservedNonDeliverableEmailAddress(to)) {
    process.stdout.write("[background-worker] skipped delivery to reserved .invalid address\n");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Layanan email belum dikonfigurasi.");
  const response = await fetch(getTransactionalEmailEndpoint(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Layanan email menolak pesan (HTTP ${response.status}).`);
}

async function sendResellerStaffAddedEmail(payload: ResellerStaffPayload) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = new URL(payload.dashboardPath, appUrl).toString();
  const greeting = payload.name ? `Halo ${payload.name},` : "Halo,";
  const subject = `Akses staf reseller · ${payload.resellerName}`;
  const text = `${greeting}\n\nKamu sekarang memiliki akses sebagai staf untuk ${payload.resellerName}. Masuk ke dashboard reseller untuk melihat pelanggan dan mengelola aktivasi.\n\n${link}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#35473b"><p>${escapeHtml(greeting)}</p><p>Kamu sekarang memiliki akses sebagai staf untuk <b>${escapeHtml(payload.resellerName)}</b>.</p><p>Masuk ke dashboard reseller untuk melihat pelanggan dan mengelola aktivasi.</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#35473b;color:#fff;padding:12px 18px;text-decoration:none">Buka dashboard reseller</a></p></div>`;
  await sendEmail(payload.to, subject, text, html);
}

async function sendResellerCustomerAccessEmail(payload: ResellerCustomerAccessPayload) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = new URL(payload.dashboardPath, appUrl).toString();
  const greeting = payload.name ? `Halo ${payload.name},` : "Halo,";
  const decisionText = payload.decision === "APPROVED" ? "menyetujui akses reseller" : payload.decision === "DECLINED" ? "menolak permintaan akses reseller" : "mencabut akses reseller";
  const subject = `Perubahan akses pelanggan · ${payload.customerName}`;
  const text = `${greeting}\n\n${payload.customerName} ${decisionText} untuk ${payload.resellerName}.\n\nBuka dashboard reseller untuk melihat status pelanggan: ${link}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#35473b"><p>${escapeHtml(greeting)}</p><p><b>${escapeHtml(payload.customerName)}</b> ${escapeHtml(decisionText)} untuk ${escapeHtml(payload.resellerName)}.</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#35473b;color:#fff;padding:12px 18px;text-decoration:none">Buka dashboard reseller</a></p></div>`;
  await sendEmail(payload.to, subject, text, html);
}

async function sendAdminManagedInvitationEmail(payload: AdminManagedInvitationPayload) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = new URL(`/dashboard/invitations/${encodeURIComponent(payload.invitationId)}/edit`, appUrl).toString();
  const name = payload.name.replace(/[\r\n]+/g, " ").trim();
  const greeting = name ? `Halo ${name},` : "Halo,";
  const invitationTitle = payload.invitationTitle.replace(/[\r\n]+/g, " ").trim();
  const subject = `Draft undangan siap ditinjau · ${invitationTitle} · TamuKita`;
  const text = `${greeting}\n\nTim TamuKita telah menyiapkan draft undangan “${invitationTitle}” untukmu. Masuk ke akunmu untuk meninjau dan melengkapi detail, foto, atau musik, lalu lanjutkan pembayaran dan terbitkan saat sudah siap.\n\nBuka draft undangan: ${link}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#35473b"><p>${escapeHtml(greeting)}</p><p>Tim TamuKita telah menyiapkan draft undangan <b>${escapeHtml(invitationTitle)}</b> untukmu.</p><p>Masuk ke akunmu untuk meninjau dan melengkapi detail, foto, atau musik, lalu lanjutkan pembayaran dan terbitkan saat sudah siap.</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#35473b;color:#fff;padding:12px 18px;text-decoration:none">Tinjau draft undangan</a></p></div>`;
  await sendEmail(payload.to, subject, text, html);
}

async function sendRsvpReceivedEmail(payload: RsvpReceivedPayload) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = new URL(`/dashboard/invitations/${payload.invitationId}/guests`, appUrl).toString();
  const ownerName = payload.ownerName.replace(/[\r\n]+/g, " ").trim();
  const greeting = ownerName ? `Halo ${ownerName},` : "Halo,";
  const invitationTitle = payload.invitationTitle.replace(/[\r\n]+/g, " ").trim();
  const attendance = payload.attendance === "ATTENDING" ? "akan hadir" : "belum dapat hadir";
  const count = payload.attendance === "ATTENDING" ? ` Jumlah tamu: ${payload.attendeeCount}.` : "";
  const subject = `RSVP baru · ${invitationTitle} · TamuKita`;
  const text = `${greeting}\n\n${payload.guestName} mengonfirmasi bahwa mereka ${attendance}.${count}\n\nUndangan: ${invitationTitle}\nLihat daftar tamu dan RSVP: ${link}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#35473b"><p>${escapeHtml(greeting)}</p><p><b>${escapeHtml(payload.guestName)}</b> mengonfirmasi bahwa mereka ${escapeHtml(attendance)}${payload.attendance === "ATTENDING" ? ` (${payload.attendeeCount} tamu)` : ""}.</p><p>Undangan: <b>${escapeHtml(invitationTitle)}</b></p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#35473b;color:#fff;padding:12px 18px;text-decoration:none">Lihat RSVP</a></p></div>`;
  await sendEmail(payload.to, subject, text, html);
}

async function sendEventReminderEmail(payload: EventReminderPayload) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const invitationLink = new URL(`/${encodeURIComponent(payload.invitationSlug)}`, appUrl).toString();
  const guestListLink = new URL("/dashboard", appUrl).toString();
  const ownerName = payload.ownerName.replace(/[\r\n]+/g, " ").trim();
  const greeting = ownerName ? `Halo ${ownerName},` : "Halo,";
  const invitationTitle = payload.invitationTitle.replace(/[\r\n]+/g, " ").trim();
  const eventTitle = payload.eventTitle.replace(/[\r\n]+/g, " ").trim();
  const venue = payload.venue.replace(/[\r\n]+/g, " ").trim();
  const eventDate = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(payload.startsAt));
  const subject = `Pengingat acara · ${invitationTitle} · TamuKita`;
  const text = `${greeting}\n\nAcara ${eventTitle} untuk undangan ${invitationTitle} dijadwalkan pada ${eventDate}${venue ? ` di ${venue}` : ""}.\n\nBuka undangan: ${invitationLink}\nKelola daftar tamu dan RSVP: ${guestListLink}`;
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.65;color:#35473b"><p>${escapeHtml(greeting)}</p><p>Acara <b>${escapeHtml(eventTitle)}</b> untuk undangan <b>${escapeHtml(invitationTitle)}</b> dijadwalkan pada <b>${escapeHtml(eventDate)}</b>${venue ? ` di ${escapeHtml(venue)}` : ""}.</p><p><a href="${escapeHtml(invitationLink)}" style="display:inline-block;background:#35473b;color:#fff;padding:12px 18px;text-decoration:none">Lihat undangan</a> <a href="${escapeHtml(guestListLink)}" style="display:inline-block;border:1px solid #35473b;color:#35473b;padding:12px 18px;text-decoration:none">Kelola tamu dan RSVP</a></p></div>`;
  await sendEmail(payload.to, subject, text, html);
}

async function processJob(job: Job<{ notificationJobId: string }>) {
  const notification = await prisma.notificationJob.findUnique({ where: { id: job.data.notificationJobId } });
  if (!notification || notification.completedAt || notification.failedAt) return;
  const attempt = job.attemptsMade + 1;
  const mediaPayload = notification.jobType === "MEDIA_PROCESSING" ? parseMediaProcessingPayload(notification.payload) : null;
  const mediaEditPayload = notification.jobType === "MEDIA_EDIT_PROCESSING" ? parseMediaEditProcessingPayload(notification.payload) : null;
  try {
    if (notification.jobType === "ORDER_PAID_EMAIL") {
      const payload = parsePayload(notification.payload);
      if (!payload) throw new Error("Data email pembayaran tidak valid.");
      await sendPaymentEmail(payload);
    } else if (notification.jobType === "RESELLER_STAFF_ADDED_EMAIL") {
      const payload = parseResellerStaffPayload(notification.payload);
      if (!payload) throw new Error("Data email staf reseller tidak valid.");
      await sendResellerStaffAddedEmail(payload);
    } else if (notification.jobType === "RESELLER_CUSTOMER_ACCESS_EMAIL") {
      const payload = parseResellerCustomerAccessPayload(notification.payload);
      if (!payload) throw new Error("Data notifikasi akses reseller tidak valid.");
      await sendResellerCustomerAccessEmail(payload);
    } else if (notification.jobType === "ADMIN_MANAGED_INVITATION_EMAIL") {
      const payload = parseAdminManagedInvitationPayload(notification.payload);
      if (!payload) throw new Error("Data pemberitahuan undangan admin tidak valid.");
      await sendAdminManagedInvitationEmail(payload);
    } else if (notification.jobType === "RSVP_RECEIVED_EMAIL") {
      const payload = parseRsvpReceivedPayload(notification.payload);
      if (!payload) throw new Error("Data notifikasi RSVP tidak valid.");
      await sendRsvpReceivedEmail(payload);
    } else if (notification.jobType === "EVENT_REMINDER_EMAIL") {
      const payload = parseEventReminderPayload(notification.payload);
      if (!payload) throw new Error("Data pengingat acara tidak valid.");
      await sendEventReminderEmail(payload);
    } else if (notification.jobType === "MEDIA_PROCESSING") {
      if (!mediaPayload) throw new Error("Data pemrosesan media tidak valid.");
      if (!mediaS3 || !mediaConfig) throw new Error("Cloudflare R2 belum dikonfigurasi pada worker.");
      await processMediaAsset(prisma, mediaS3, mediaConfig, mediaPayload);
    } else if (notification.jobType === "MEDIA_EDIT_PROCESSING") {
      if (!mediaEditPayload) throw new Error("Data edit media tidak valid.");
      if (!mediaS3 || !mediaConfig) throw new Error("Cloudflare R2 belum dikonfigurasi pada worker.");
      const result = await processMediaEdit(prisma, mediaS3, mediaConfig, mediaEditPayload);
      await prisma.notificationJob.update({
        where: { id: notification.id },
        data: { payload: { ...(isRecord(notification.payload) ? notification.payload : {}), ...result } },
      });
    } else {
      throw new Error("Jenis notifikasi tidak dikenal.");
    }
    await prisma.notificationJob.update({
      where: { id: notification.id },
      data: { attempts: attempt, completedAt: new Date(), lastError: null },
    });
  } catch (error) {
    const maxAttempts = Number(job.opts.attempts ?? 5);
    const message = error instanceof Error ? error.message.slice(0, 500) : "Pengiriman notifikasi gagal.";
    const mediaFailure = (notification.jobType === "MEDIA_PROCESSING" || notification.jobType === "MEDIA_EDIT_PROCESSING")
      && (error instanceof InvalidMediaAssetError || attempt >= maxAttempts);
    if (mediaFailure) {
      if (mediaPayload) await failMediaProcessing(prisma, mediaS3, mediaConfig, mediaPayload).catch(() => undefined);
      if (mediaEditPayload) await failMediaEdit(prisma, mediaS3, mediaConfig, mediaEditPayload).catch(() => undefined);
      await prisma.notificationJob.update({
        where: { id: notification.id },
        data: { attempts: attempt, failedAt: new Date(), lastError: message },
      });
      return;
    }
    await prisma.notificationJob.update({
      where: { id: notification.id },
      data: {
        attempts: attempt,
        lastError: message,
        ...(attempt >= maxAttempts ? { failedAt: new Date() } : {}),
      },
    });
    throw error;
  }
}

const worker = new Worker(queueName, processJob, { connection, concurrency: 4 });
let reconciling = false;
let schedulingEventReminders = false;
let runningDataRetention = false;
let lastHeartbeatErrorAt = 0;

async function refreshWorkerHeartbeat() {
  if (!worker.isRunning() || connection.status !== "ready") return false;
  try {
    const snapshot = createWorkerIntegrationSnapshot(getWorkerIntegrationConfigurations());
    const results = await connection.multi()
      .set(WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_VALUE, "EX", WORKER_HEARTBEAT_TTL_SECONDS)
      .set(WORKER_CONFIGURATION_KEY, JSON.stringify(snapshot), "EX", WORKER_HEARTBEAT_TTL_SECONDS)
      .exec();
    if (!results || results.some(([error]) => error)) throw new Error("Redis rejected the worker heartbeat update.");
    lastHeartbeatErrorAt = 0;
    return true;
  } catch (error) {
    const now = Date.now();
    if (now - lastHeartbeatErrorAt >= 60_000) {
      const detail = error instanceof Error ? error.message : "unknown error";
      process.stderr.write(`[background-worker] heartbeat refresh failed: ${detail}\n`);
      lastHeartbeatErrorAt = now;
    }
    return false;
  }
}

async function scheduleEventReminders() {
  if (schedulingEventReminders) return;
  schedulingEventReminders = true;
  try {
    const now = new Date();
    const reminderCutoff = new Date(now.getTime() + 24 * 60 * 60 * 1_000);
    let cursor: { id: string } | undefined;

    while (true) {
      const events = await prisma.event.findMany({
        where: {
          startsAt: { gt: now, lte: reminderCutoff },
          invitation: { is: { status: "PUBLISHED" } },
        },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        take: 500,
        ...(cursor ? { cursor, skip: 1 } : {}),
        select: {
          id: true,
          title: true,
          startsAt: true,
          venue: true,
          invitation: {
            select: {
              title: true,
              slug: true,
              expiresAt: true,
              owner: { select: { name: true, email: true } },
            },
          },
        },
      });
      if (events.length === 0) break;

      const eligibleEvents = events.filter((event) =>
        (!event.invitation.expiresAt || event.invitation.expiresAt > now)
        && event.invitation.owner.email,
      );
      if (eligibleEvents.length > 0) {
        await prisma.notificationJob.createMany({
          data: eligibleEvents.map((event) => ({
            jobKey: `event-reminder:${event.id}:${event.startsAt.getTime()}`,
            jobType: "EVENT_REMINDER_EMAIL",
            availableAt: now,
            payload: {
              to: event.invitation.owner.email,
              ownerName: event.invitation.owner.name ?? "",
              invitationTitle: event.invitation.title,
              invitationSlug: event.invitation.slug,
              eventTitle: event.title,
              startsAt: event.startsAt.toISOString(),
              venue: event.venue,
            },
          })),
          skipDuplicates: true,
        });
      }

      if (events.length < 500) break;
      cursor = { id: events[events.length - 1].id };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    process.stderr.write(`[background-worker] event reminder scheduling failed: ${detail}\n`);
  } finally {
    schedulingEventReminders = false;
  }
}

async function reconcileOutbox() {
  if (reconciling) return;
  reconciling = true;
  try {
    const pending = await prisma.notificationJob.findMany({
      where: { completedAt: null, failedAt: null, availableAt: { lte: new Date() } },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      take: 100,
      select: { id: true, jobType: true },
    });
    for (const notification of pending) {
      await queue.add(notification.jobType, { notificationJobId: notification.id }, {
        jobId: notification.id,
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: false,
      });
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    process.stderr.write(`[background-worker] outbox reconciliation failed: ${detail}\n`);
  } finally {
    reconciling = false;
  }
}

async function scheduleDataRetentionSweep() {
  if (process.env.DATA_RETENTION_ENABLED !== "true" || runningDataRetention || connection.status !== "ready") return;
  runningDataRetention = true;
  const lockToken = randomUUID();
  let acquired = false;
  let lockRefreshTimer: NodeJS.Timeout | undefined;
  try {
    acquired = (await connection.set(DATA_RETENTION_LOCK_KEY, lockToken, "EX", DATA_RETENTION_LOCK_TTL_SECONDS, "NX")) === "OK";
    if (!acquired) return;
    lockRefreshTimer = setInterval(() => {
      void connection.eval(REFRESH_DATA_RETENTION_LOCK_SCRIPT, 1, DATA_RETENTION_LOCK_KEY, lockToken, DATA_RETENTION_LOCK_TTL_SECONDS).catch(() => undefined);
    }, 60_000);
    const report = await runDataRetentionSweep(prisma, {
      now: new Date(),
      ...(mediaBuckets && mediaS3 ? {
        privateBucket: mediaBuckets.privateBucket,
        publicBucket: mediaBuckets.publicBucket,
        deleteObject: async (bucket: string, key: string) => {
          await mediaS3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        },
      } : {}),
    });
    process.stdout.write(`[background-worker] data retention sweep completed: ${JSON.stringify(report)}\n`);
  } catch {
    process.stderr.write("[background-worker] data retention sweep failed\n");
  } finally {
    if (lockRefreshTimer) clearInterval(lockRefreshTimer);
    if (acquired) {
      await connection.eval(RELEASE_DATA_RETENTION_LOCK_SCRIPT, 1, DATA_RETENTION_LOCK_KEY, lockToken).catch(() => undefined);
    }
    runningDataRetention = false;
  }
}

worker.on("ready", () => {
  void refreshWorkerHeartbeat().then((heartbeatAvailable) => {
    if (heartbeatAvailable) process.stdout.write("[background-worker] ready\n");
  });
  void scheduleDataRetentionSweep();
});
worker.on("failed", (job, error) => {
  if (job && job.attemptsMade >= Number(job.opts.attempts ?? 5)) {
    process.stderr.write(`[background-worker] job ${job.id} failed after retries: ${error.message}\n`);
  }
});

void reconcileOutbox();
const reconciliationTimer = setInterval(() => void reconcileOutbox(), 15_000);
void scheduleEventReminders();
const eventReminderTimer = setInterval(() => void scheduleEventReminders(), 60_000);
const workerHeartbeatTimer = setInterval(() => void refreshWorkerHeartbeat(), 15_000);
const dataRetentionTimer = setInterval(() => void scheduleDataRetentionSweep(), DATA_RETENTION_INTERVAL_MS);

async function shutdown() {
  clearInterval(reconciliationTimer);
  clearInterval(eventReminderTimer);
  clearInterval(workerHeartbeatTimer);
  clearInterval(dataRetentionTimer);
  await worker.close();
  await queue.close();
  await prisma.$disconnect();
  mediaS3?.destroy();
  await connection.quit();
}

process.once("SIGINT", () => { void shutdown().finally(() => process.exit(0)); });
process.once("SIGTERM", () => { void shutdown().finally(() => process.exit(0)); });
