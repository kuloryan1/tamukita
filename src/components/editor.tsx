"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, Info, Monitor, Music2, Pencil, Redo2, RotateCcw, RotateCw, Save, Smartphone, Sparkles, Undo2, Upload, X } from "lucide-react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { InvitationPreview } from "@/components/invitation-preview";
import { EditorFeedbackDialog } from "@/components/editor-feedback-dialog";
import { formatRupiah, getTemplate, templates as builtInTemplates, type TemplateSchemaField } from "@/lib/templates";
import type { Template } from "@/lib/template-sdk";
import { createInitialDraft, EVENT_KINDS, EVENT_KIND_TITLE_SUGGESTIONS, familyDetailsPrompt, isSlugAllowed, slugify, type EventKind, type InvitationDraft } from "@/lib/invitations";
import { validateInvitationDraft } from "@/lib/validation";

const steps = ["Acara", "Detail", "Foto", "Tampilan", "Preview"];
const eventKindIcons: Record<EventKind, string> = {
  Pernikahan: "♡",
  "Ulang Tahun": "✦",
  Khitan: "✧",
  "Acara Perusahaan": "▦",
  Pertunangan: "✧",
  "Acara Lainnya": "✳",
};
const themeColorOptions = [
  { value: "default", label: "Template", swatch: "" },
  { value: "rose", label: "Rose", swatch: "#b8758a" },
  { value: "ocean", label: "Ocean", swatch: "#6d91a8" },
] as const;
const themeFontOptions = [
  { value: "classic", label: "Klasik" },
  { value: "modern", label: "Modern" },
] as const;
const sectionOrderOptions = [
  { value: "story-first", label: "Cerita dulu" },
  { value: "details-first", label: "Info acara dulu" },
] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  // biome-ignore lint/a11y/noLabelWithoutControl: Field is used for input controls; the event-kind button group uses a separate group wrapper.
  return <label className="editor-field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

function formatShortDate(value: string) {
  if (!value) return "Pilih tanggal acara";
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Foto tidak dapat dipotong di browser ini.")), type, quality);
  });
}

async function createCroppedPhoto(source: string, crop: Area, rotation: number) {
  const image = await loadImage(source);
  const radians = rotation * Math.PI / 180;
  const boundWidth = Math.abs(Math.cos(radians) * image.width) + Math.abs(Math.sin(radians) * image.height);
  const boundHeight = Math.abs(Math.sin(radians) * image.width) + Math.abs(Math.cos(radians) * image.height);
  const workingScale = Math.min(1, 4800 / boundWidth, 4800 / boundHeight);
  const rotated = document.createElement("canvas");
  rotated.width = Math.max(1, Math.round(boundWidth * workingScale));
  rotated.height = Math.max(1, Math.round(boundHeight * workingScale));
  const rotatedContext = rotated.getContext("2d");
  if (!rotatedContext) throw new Error("Foto tidak dapat diproses di browser ini.");
  rotatedContext.translate(rotated.width / 2, rotated.height / 2);
  rotatedContext.rotate(radians);
  rotatedContext.scale(workingScale, workingScale);
  rotatedContext.drawImage(image, -image.width / 2, -image.height / 2);

  const outputScale = Math.min(1, 2400 / crop.width, 2400 / crop.height);
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(crop.width * outputScale));
  output.height = Math.max(1, Math.round(crop.height * outputScale));
  const outputContext = output.getContext("2d");
  if (!outputContext) throw new Error("Foto tidak dapat diproses di browser ini.");
  outputContext.drawImage(
    rotated,
    crop.x * workingScale,
    crop.y * workingScale,
    crop.width * workingScale,
    crop.height * workingScale,
    0,
    0,
    output.width,
    output.height,
  );
  return canvasBlob(output, "image/webp", 0.92);
}

async function waitForMediaAsset(assetId: string) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const response = await fetch(`/api/media/${encodeURIComponent(assetId)}/status`, { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { status?: string; publicUrl?: string; error?: string } | null;
    if (!response?.ok) throw new Error(result?.error ?? "Status pemrosesan media tidak dapat diperiksa.");
    if (result?.status === "READY" && result.publicUrl) return result.publicUrl;
    if (result?.status === "FAILED") throw new Error(result.error ?? "Media gagal diproses. Pilih file yang valid dan coba lagi.");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
  }
  throw new Error("Media masih diproses di latar belakang. Coba lagi beberapa saat lagi sebelum mengunggah ulang.");
}

async function waitForMediaEdit(assetId: string, revisionKey: string) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const query = new URLSearchParams({ revisionKey });
    const response = await fetch(`/api/media/${encodeURIComponent(assetId)}/edit/complete?${query}`, { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { status?: string; publicUrl?: string; error?: string } | null;
    if (!response?.ok) throw new Error(result?.error ?? "Status edit foto tidak dapat diperiksa.");
    if (result?.status === "READY" && result.publicUrl) return result.publicUrl;
    if (result?.status === "FAILED") throw new Error(result.error ?? "Edit foto gagal diproses. Muat ulang editor lalu coba lagi.");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 800));
  }
  throw new Error("Edit foto masih diproses di latar belakang. Tunggu sebentar lalu coba lagi.");
}

type PendingMediaTask = {
  assetId: string;
  kind: "cover" | "cover-edit" | "gallery" | "music";
  previousUrl?: string;
  title?: string;
  revisionKey?: string;
};

type DraftHistoryEntry = {
  before: InvitationDraft;
  after: InvitationDraft;
  changedKeys: (keyof InvitationDraft)[];
  group: string | null;
  updatedAt: number;
};

function changedDraftKeys(before: InvitationDraft, after: InvitationDraft) {
  return (Object.keys(before) as (keyof InvitationDraft)[]).filter((key) => !Object.is(before[key], after[key]));
}

function applyHistoryEntry(current: InvitationDraft, entry: DraftHistoryEntry, direction: "undo" | "redo") {
  const restored = { ...current };
  for (const key of entry.changedKeys) {
    Object.assign(restored, { [key]: direction === "undo" ? entry.before[key] : entry.after[key] });
  }
  return restored;
}

function pendingMediaStorageKey(invitationId: string) {
  return `tamukita:pending-media:${invitationId}`;
}

function isPendingMediaTask(value: unknown): value is PendingMediaTask {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.assetId === "string"
    && ["cover", "cover-edit", "gallery", "music"].includes(String(record.kind))
    && (record.kind !== "cover-edit" || typeof record.revisionKey === "string");
}

function readPendingMedia(invitationId: string): PendingMediaTask[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(pendingMediaStorageKey(invitationId)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(isPendingMediaTask);
  } catch {
    return [];
  }
}

function rememberPendingMedia(invitationId: string, task: PendingMediaTask) {
  const pending = readPendingMedia(invitationId).filter((item) => item.assetId !== task.assetId || item.revisionKey !== task.revisionKey);
  try {
    sessionStorage.setItem(pendingMediaStorageKey(invitationId), JSON.stringify([...pending, task]));
  } catch {
    // Media processing still completes on the server if browser storage is unavailable.
  }
}

function forgetPendingMedia(invitationId: string, task: PendingMediaTask) {
  const pending = readPendingMedia(invitationId).filter((item) => item.assetId !== task.assetId || item.revisionKey !== task.revisionKey);
  try {
    if (pending.length) sessionStorage.setItem(pendingMediaStorageKey(invitationId), JSON.stringify(pending));
    else sessionStorage.removeItem(pendingMediaStorageKey(invitationId));
  } catch {
    // Media processing still completes on the server if browser storage is unavailable.
  }
}

function SchemaFieldControl({ field, value, onChange }: { field: TemplateSchemaField; value: string; onChange: (value: string) => void }) {
  if (field.type === "textarea") {
    return <textarea className="text-input text-area" value={value} onChange={(event) => onChange(event.target.value)} rows={field.key === "address" ? 2 : 3} placeholder={field.label} />;
  }
  const type = field.type === "datetime" ? "date" : field.type === "time" ? "time" : field.type === "url" ? "url" : "text";
  return <input className="text-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.label} />;
}

export function InvitationEditor({ invitationId, templateCatalog }: { invitationId?: string; templateCatalog?: Template[] } = {}) {
  const router = useRouter();
  const [draft, setDraft] = useState<InvitationDraft>(createInitialDraft);
  const [previewDevice, setPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  const draftRef = useRef(draft);
  const draftSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSavedDraftRef = useRef<InvitationDraft | null>(null);
  const historyRef = useRef<{ past: DraftHistoryEntry[]; future: DraftHistoryEntry[] }>({ past: [], future: [] });
  const [, setHistoryVersion] = useState(0);
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<"saving" | "saved" | "error">("saved");
  const [error, setError] = useState("");
  const [published, setPublished] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [musicRightsConfirmed, setMusicRightsConfirmed] = useState(false);
  const [photoToCrop, setPhotoToCrop] = useState<{ file: File; previewUrl: string; assetId?: string; baseRevision?: number; initialArea?: Area } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const pendingRecoveryFor = useRef<string | null>(null);
  const replaceDraft = useCallback((nextDraft: InvitationDraft | ((current: InvitationDraft) => InvitationDraft)) => {
    const next = typeof nextDraft === "function" ? nextDraft(draftRef.current) : nextDraft;
    draftRef.current = next;
    setDraft(next);
  }, []);
  const setLoadedDraft = useCallback((nextDraft: InvitationDraft) => {
    historyRef.current = { past: [], future: [] };
    setHistoryVersion((version) => version + 1);
    replaceDraft(nextDraft);
  }, [replaceDraft]);
  const updateDraft = useCallback((transform: (current: InvitationDraft) => InvitationDraft, group?: string) => {
    const current = draftRef.current;
    const next = transform(current);
    if (next === current) return;
    const history = historyRef.current;
    const now = Date.now();
    const changedKeys = changedDraftKeys(current, next);
    if (!changedKeys.length) return;
    const lastEntry = history.past[history.past.length - 1];
    const coalesce = Boolean(group && lastEntry?.group === group && now - lastEntry.updatedAt < 800);
    if (!coalesce) {
      history.past.push({ before: current, after: next, changedKeys, group: group ?? null, updatedAt: now });
      if (history.past.length > 50) history.past.shift();
    } else if (lastEntry) {
      lastEntry.after = next;
      lastEntry.changedKeys = changedDraftKeys(lastEntry.before, next);
      lastEntry.updatedAt = now;
    }
    history.future = [];
    setHistoryVersion((version) => version + 1);
    replaceDraft(next);
  }, [replaceDraft]);
  const saveDraft = useCallback((flushLatest = false) => {
    const saveQueuedDraft = async (): Promise<{ ok: true; draft: InvitationDraft } | { ok: false; draft: InvitationDraft; error: string }> => {
      while (true) {
        const sourceDraft = draftRef.current;
        const snapshot = { ...sourceDraft, slug: slugify(sourceDraft.slug) };
        if (lastSavedDraftRef.current === sourceDraft) {
          if (draftRef.current === sourceDraft) {
            setError("");
            setSaveState("saved");
          }
          return { ok: true, draft: snapshot };
        }
        if (draftRef.current === sourceDraft) setSaveState("saving");
        const response = await fetch(`/api/invitations/${encodeURIComponent(snapshot.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot),
        }).catch(() => null);
        const result = await response?.json().catch(() => null) as { error?: string } | null;
        if (!response?.ok) {
          const message = result?.error ?? "Draft belum tersimpan. Coba lagi setelah koneksi pulih.";
          if (draftRef.current === sourceDraft) {
            setError(message);
            setSaveState("error");
          }
          if (flushLatest && draftRef.current !== sourceDraft) continue;
          return { ok: false, draft: snapshot, error: message };
        }
        if (draftRef.current === sourceDraft) {
          lastSavedDraftRef.current = sourceDraft;
          setError("");
          setSaveState("saved");
        } else {
          lastSavedDraftRef.current = sourceDraft;
        }
        if (flushLatest && draftRef.current !== sourceDraft) continue;
        return { ok: true, draft: snapshot };
      }
    };

    const queuedSave = draftSaveQueueRef.current.then(saveQueuedDraft, saveQueuedDraft);
    draftSaveQueueRef.current = queuedSave.then(() => undefined, () => undefined);
    return queuedSave;
  }, []);
  const undoDraft = useCallback(() => {
    const history = historyRef.current;
    const entry = history.past.pop();
    if (!entry) return;
    history.future.push(entry);
    setHistoryVersion((version) => version + 1);
    replaceDraft(applyHistoryEntry(draftRef.current, entry, "undo"));
  }, [replaceDraft]);
  const redoDraft = useCallback(() => {
    const history = historyRef.current;
    const entry = history.future.pop();
    if (!entry) return;
    history.past.push(entry);
    if (history.past.length > 50) history.past.shift();
    setHistoryVersion((version) => version + 1);
    replaceDraft(applyHistoryEntry(draftRef.current, entry, "redo"));
  }, [replaceDraft]);
  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  const templates = templateCatalog?.length ? templateCatalog : builtInTemplates;
  const selectedLegacyTemplate = getTemplate(draft.templateId);
  const templateChoices = templates.some((template) => template.slug === draft.templateId) || !selectedLegacyTemplate ? templates : [...templates, selectedLegacyTemplate];
  const activeTemplate = templateChoices.find((template) => template.slug === draft.templateId) ?? templateChoices[0] ?? builtInTemplates[0];
  const identityFields = activeTemplate.schema.sections.find((section) => section.key === "identity")?.fields ?? [];
  const scheduleFields = activeTemplate.schema.sections.find((section) => section.key === "schedule")?.fields ?? [];
  const familyPrompt = familyDetailsPrompt(draft.eventKind);
  const coverField = activeTemplate.schema.sections.find((section) => section.key === "media")?.fields[0];
  const slugIsAvailable = draft.isPublished || isSlugAllowed(slugify(draft.slug));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.shiftKey && canRedo) {
        event.preventDefault();
        redoDraft();
      } else if (!event.shiftKey && canUndo) {
        event.preventDefault();
        undoDraft();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canRedo, canUndo, redoDraft, undoDraft]);

  useEffect(() => {
    if (!photoToCrop) return;
    const { previewUrl } = photoToCrop;
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoToCrop]);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      const params = new URLSearchParams(window.location.search);
      const requestedId = invitationId ?? params.get("id");
      const selectedTemplate = templates.find((template) => template.slug === params.get("template"));
      if (params.get("new") !== "1" && requestedId) {
        const query = `?id=${encodeURIComponent(requestedId)}`;
        const response = await fetch(`/api/invitations/drafts${query}`, { cache: "no-store" }).catch(() => null);
        if (response?.status === 401) {
          window.location.assign("/login");
          return;
        }
        const result = await response?.json().catch(() => null) as { draft?: InvitationDraft | null } | null;
        if (!cancelled && response?.ok && result?.draft) {
          setLoadedDraft({ ...result.draft, coverPositionX: result.draft.coverPositionX ?? 50, ...(selectedTemplate ? { templateId: selectedTemplate.slug, templateVersion: selectedTemplate.version } : {}) });
          setHydrated(true);
          return;
        }
        if (requestedId && !response?.ok) {
          if (!cancelled) {
            setError("Draft tidak dapat dibuka. Periksa koneksi atau akses akunmu.");
            setSaveState("error");
            setHydrated(true);
          }
          return;
        }
      }
      const initial = createInitialDraft();
      const response = await fetch("/api/invitations/drafts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...initial, ...(selectedTemplate ? { templateId: selectedTemplate.slug, templateVersion: selectedTemplate.version } : {}) }),
      }).catch(() => null);
      if (response?.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = await response?.json().catch(() => null) as { draft?: InvitationDraft; error?: string } | null;
      if (!cancelled && response?.ok && result?.draft) {
        setLoadedDraft(result.draft);
        window.history.replaceState(window.history.state, "", `/dashboard/invitations/${encodeURIComponent(result.draft.id)}/edit`);
      } else if (!cancelled) {
        setError(result?.error ?? "Draft belum dapat dibuat. Pastikan layanan database aktif.");
        setSaveState("error");
      }
      if (!cancelled) setHydrated(true);
    }
    void initialize();
    return () => { cancelled = true; };
  }, [invitationId, setLoadedDraft, templates]);

  useEffect(() => {
    if (!hydrated || !draft.id || pendingRecoveryFor.current === draft.id) return;
    pendingRecoveryFor.current = draft.id;
    const pending = readPendingMedia(draft.id);
    if (!pending.length) return;
    let cancelled = false;
    setUploadingPhoto(pending.some((task) => task.kind === "cover" || task.kind === "cover-edit"));
    setUploadingGallery(pending.some((task) => task.kind === "gallery"));
    setUploadingMusic(pending.some((task) => task.kind === "music"));
    void Promise.all(pending.map(async (task) => {
      try {
        const publicUrl = task.kind === "cover-edit" && task.revisionKey
          ? await waitForMediaEdit(task.assetId, task.revisionKey)
          : await waitForMediaAsset(task.assetId);
        if (cancelled) return;
        if (task.kind === "cover" || task.kind === "cover-edit") {
          replaceDraft(current => current.coverPhoto === (task.previousUrl ?? "") ? { ...current, coverPhoto: publicUrl } : current);
        } else if (task.kind === "gallery") {
          replaceDraft((current) => {
            const photos = current.galleryPhotos ?? [];
            return photos.includes(publicUrl) || photos.length >= 6 ? current : { ...current, galleryPhotos: [...photos, publicUrl] };
          });
        } else if (task.kind === "music") {
          replaceDraft((current) => current.musicUrl === (task.previousUrl ?? "")
            ? { ...current, musicUrl: publicUrl, musicTitle: task.title ?? current.musicTitle }
            : current);
        }
        forgetPendingMedia(draft.id, task);
      } catch (caught) {
        if (cancelled) return;
        const statusUrl = task.kind === "cover-edit" && task.revisionKey
          ? `/api/media/${encodeURIComponent(task.assetId)}/edit/complete?${new URLSearchParams({ revisionKey: task.revisionKey })}`
          : `/api/media/${encodeURIComponent(task.assetId)}/status`;
        const statusResponse = await fetch(statusUrl, { cache: "no-store" }).catch(() => null);
        const state = await statusResponse?.json().catch(() => null) as { status?: string } | null;
        if (statusResponse?.status === 404 || state?.status === "FAILED") forgetPendingMedia(draft.id, task);
        else setError(caught instanceof Error ? caught.message : "Media masih diproses di latar belakang.");
      }
    })).finally(() => {
      if (!cancelled) {
        setUploadingPhoto(false);
        setUploadingGallery(false);
        setUploadingMusic(false);
      }
    });
    return () => { cancelled = true; };
  }, [hydrated, draft.id, replaceDraft]);

  useEffect(() => {
    if (!hydrated || !/^[0-9a-f-]{36}$/i.test(draft.id)) return;
    setSaveState("saving");
    const timer = window.setTimeout(() => { void saveDraft(); }, 550);
    return () => window.clearTimeout(timer);
  }, [draft, hydrated, saveDraft]);

  const update = <K extends keyof InvitationDraft>(key: K, value: InvitationDraft[K]) => {
    updateDraft((current) => ({ ...current, [key]: value }), `field:${String(key)}`);
    setError("");
  };

  const updateHost = (key: "hostOne" | "hostTwo", value: string) => {
    updateDraft((current) => {
      const next = { ...current, [key]: value };
      const nextSlug = slugify(next.eventKind === "Pernikahan" ? `${next.hostOne} ${next.hostTwo}` : next.eventTitle);
      return { ...next, slug: nextSlug || current.slug };
    }, `field:${key}`);
    setError("");
  };

  const updateSchemaField = (key: string, value: string) => {
    if (key === "hostOne" || key === "hostTwo") {
      updateHost(key, value);
      return;
    }
    if (key === "eventTitle") {
      updateDraft((current) => ({ ...current, eventTitle: value, slug: slugify(value) || current.slug }), "field:eventTitle");
      setError("");
      return;
    }
    if (key === "eventDate" || key === "eventTime" || key === "venue" || key === "address" || key === "mapsUrl" || key === "story") {
      update(key, value);
    }
  };

  const renderSchemaField = (field: TemplateSchemaField) => {
    const value = String(draft[field.key as keyof InvitationDraft] ?? "");
    return <Field key={field.key} label={field.label} hint={field.key === "mapsUrl" ? "Tambahkan agar tamu dapat membuka petunjuk arah." : undefined}><SchemaFieldControl field={field} value={value} onChange={(nextValue) => updateSchemaField(field.key, nextValue)} /></Field>;
  };

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!("image/jpeg image/png image/webp").split(" ").includes(file.type)) {
      setError("Pilih file JPG, PNG, atau WebP.");
      event.target.value = "";
      return;
    }
    if (file.size > 5_000_000) {
      setError("Ukuran foto maksimal 5 MB.");
      event.target.value = "";
      return;
    }
    if (!draft.id) {
      setError("Draft belum siap. Tunggu sebentar lalu coba lagi.");
      event.target.value = "";
      return;
    }
    setError("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setPhotoToCrop({ file, previewUrl: URL.createObjectURL(file) });
    event.target.value = "";
  };

  const editExistingPhoto = async () => {
    if (!draft.id || !draft.coverPhoto) return;
    setUploadingPhoto(true);
    setError("");
    try {
      const response = await fetch(`/api/media/cover-edit?invitationId=${encodeURIComponent(draft.id)}`, { cache: "no-store" });
      const source = await response.json().catch(() => null) as { assetId?: string; sourceUrl?: string; originalName?: string; contentType?: string; baseRevision?: number; cropData?: Record<string, unknown> | null; error?: string } | null;
      if (!response.ok || !source?.assetId || !source.sourceUrl || typeof source.baseRevision !== "number") throw new Error(source?.error ?? "Foto asli tidak tersedia untuk diedit.");
      const sourceResponse = await fetch(source.sourceUrl, { cache: "no-store" });
      if (!sourceResponse.ok) throw new Error("Foto asli belum dapat dibuka. Coba lagi.");
      const blob = await sourceResponse.blob();
      const contentType = source.contentType ?? blob.type;
      if (!blob.size || blob.size > 5_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(contentType)) throw new Error("File foto asli tidak valid.");
      const file = new File([blob], source.originalName ?? "foto-sampul", { type: contentType });
      const cropData = source.cropData ?? {};
      const initialArea = [cropData.x, cropData.y, cropData.width, cropData.height].every((value) => typeof value === "number")
        ? { x: cropData.x as number, y: cropData.y as number, width: cropData.width as number, height: cropData.height as number }
        : undefined;
      const cropOffset = cropData.cropOffset;
      setCrop(typeof cropOffset === "object" && cropOffset !== null && "x" in cropOffset && "y" in cropOffset
        ? { x: Number(cropOffset.x) || 0, y: Number(cropOffset.y) || 0 }
        : { x: 0, y: 0 });
      setZoom(typeof cropData.zoom === "number" ? Math.min(3, Math.max(1, cropData.zoom)) : 1);
      setRotation(typeof cropData.rotation === "number" ? cropData.rotation : 0);
      setCroppedAreaPixels(null);
      setPhotoToCrop({ file, previewUrl: URL.createObjectURL(file), assetId: source.assetId, baseRevision: source.baseRevision, initialArea });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Foto asli belum dapat dibuka. Coba lagi.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const uploadCroppedPhoto = async () => {
    if (!photoToCrop || !croppedAreaPixels || !draft.id) {
      setError("Atur area foto yang ingin digunakan.");
      return;
    }
    setUploadingPhoto(true);
    setError("");
    try {
      const blob = await createCroppedPhoto(photoToCrop.previewUrl, croppedAreaPixels, rotation);
      if (blob.size > 5_000_000) throw new Error("Hasil foto masih terlalu besar. Perkecil area crop lalu coba lagi.");
      const contentType = blob.type === "image/webp" ? "image/webp" : "image/png";
      const file = new File([blob], contentType === "image/webp" ? "cover.webp" : "cover.png", { type: contentType, lastModified: Date.now() });
      const cropData = { ...croppedAreaPixels, zoom, rotation, cropOffset: crop };
      if (photoToCrop.assetId && typeof photoToCrop.baseRevision === "number") {
        const editResponse = await fetch(`/api/media/${encodeURIComponent(photoToCrop.assetId)}/edit`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ baseRevision: photoToCrop.baseRevision, cropContentType: file.type, cropSizeBytes: file.size, cropData }),
        });
        const editUpload = await editResponse.json().catch(() => null) as { uploadUrl?: string; revisionKey?: string; error?: string } | null;
        if (!editResponse.ok || !editUpload?.uploadUrl || !editUpload.revisionKey) throw new Error(editUpload?.error ?? "Edit foto belum dapat dimulai.");
        const putResponse = await fetch(editUpload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!putResponse.ok) throw new Error("Hasil edit gagal diunggah. Periksa koneksi lalu coba lagi.");
        const completeResponse = await fetch(`/api/media/${encodeURIComponent(photoToCrop.assetId)}/edit/complete`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ revisionKey: editUpload.revisionKey, baseRevision: photoToCrop.baseRevision, cropSizeBytes: file.size, cropData }),
        });
        const completed = await completeResponse.json().catch(() => null) as { publicUrl?: string; error?: string } | null;
        if (!completeResponse.ok) throw new Error(completed?.error ?? "Edit foto gagal diproses. Coba lagi.");
        const pendingTask: PendingMediaTask = { assetId: photoToCrop.assetId, kind: "cover-edit", revisionKey: editUpload.revisionKey, previousUrl: draft.coverPhoto };
        rememberPendingMedia(draft.id, pendingTask);
        const publicUrl = completed?.publicUrl ?? await waitForMediaEdit(photoToCrop.assetId, editUpload.revisionKey);
        forgetPendingMedia(draft.id, pendingTask);
        update("coverPhoto", publicUrl);
        setPhotoToCrop(null);
        return;
      }
      const createResponse = await fetch("/api/media/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invitationId: draft.id, originalName: photoToCrop.file.name, contentType: photoToCrop.file.type, sizeBytes: photoToCrop.file.size, cropContentType: file.type, cropSizeBytes: file.size, cropData }),
      });
      const upload = await createResponse.json().catch(() => null) as { assetId?: string; originalUploadUrl?: string; croppedUploadUrl?: string; error?: string } | null;
      if (!createResponse.ok || !upload?.assetId || !upload.originalUploadUrl || !upload.croppedUploadUrl) throw new Error(upload?.error ?? "Unggahan belum dapat dimulai.");

      const [originalPut, croppedPut] = await Promise.all([
        fetch(upload.originalUploadUrl, { method: "PUT", headers: { "Content-Type": photoToCrop.file.type }, body: photoToCrop.file }),
        fetch(upload.croppedUploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file }),
      ]);
      if (!originalPut.ok || !croppedPut.ok) throw new Error("Foto gagal diunggah ke penyimpanan. Periksa koneksi dan konfigurasi bucket.");

      const completeResponse = await fetch(`/api/media/${encodeURIComponent(upload.assetId)}/complete`, { method: "POST" });
      const completed = await completeResponse.json().catch(() => null) as { publicUrl?: string; error?: string } | null;
      if (!completeResponse.ok) throw new Error(completed?.error ?? "Foto gagal diproses. Coba unggah kembali.");
      const pendingTask: PendingMediaTask = { assetId: upload.assetId, kind: "cover", previousUrl: draft.coverPhoto };
      rememberPendingMedia(draft.id, pendingTask);
      const publicUrl = completed?.publicUrl ?? await waitForMediaAsset(upload.assetId);
      forgetPendingMedia(draft.id, pendingTask);
      update("coverPhoto", publicUrl);
      setPhotoToCrop(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Foto gagal diunggah. Coba lagi.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const resetPhotoCrop = () => {
    setPhotoToCrop((current) => current ? { ...current, previewUrl: URL.createObjectURL(current.file), initialArea: undefined } : current);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
  };

  const uploadGalleryFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const existing = draft.galleryPhotos ?? [];
    if (files.length > 6 - existing.length) {
      setError(`Galeri maksimal 6 foto. Saat ini tersedia ${6 - existing.length} slot.`);
      return;
    }
    const invalidType = files.find((file) => !("image/jpeg image/png image/webp").split(" ").includes(file.type));
    if (invalidType) { setError("Pilih foto JPG, PNG, atau WebP."); return; }
    if (files.some((file) => file.size > 5_000_000)) { setError("Setiap foto galeri maksimal 5 MB."); return; }
    if (!draft.id) { setError("Draft belum siap. Tunggu sebentar lalu coba lagi."); return; }

    setUploadingGallery(true); setError("");
    const uploadedUrls: string[] = [];
    try {
      for (const file of files) {
        const createResponse = await fetch("/api/media/gallery-uploads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ invitationId: draft.id, originalName: file.name, contentType: file.type, sizeBytes: file.size }),
        });
        const upload = await createResponse.json().catch(() => null) as { assetId?: string; uploadUrl?: string; error?: string } | null;
        if (!createResponse.ok || !upload?.assetId || !upload.uploadUrl) throw new Error(upload?.error ?? "Unggahan foto galeri belum dapat dimulai.");
        const putResponse = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!putResponse.ok) throw new Error("Foto galeri gagal diunggah. Periksa koneksi dan konfigurasi bucket.");
        const completeResponse = await fetch(`/api/media/${encodeURIComponent(upload.assetId)}/complete`, { method: "POST" });
        const completed = await completeResponse.json().catch(() => null) as { publicUrl?: string; error?: string } | null;
        if (!completeResponse.ok) throw new Error(completed?.error ?? "Foto galeri gagal diproses.");
        const pendingTask: PendingMediaTask = { assetId: upload.assetId, kind: "gallery" };
        rememberPendingMedia(draft.id, pendingTask);
        uploadedUrls.push(completed?.publicUrl ?? await waitForMediaAsset(upload.assetId));
        forgetPendingMedia(draft.id, pendingTask);
      }
      if (uploadedUrls.length) updateDraft((current) => ({ ...current, galleryPhotos: [...(current.galleryPhotos ?? []), ...uploadedUrls] }));
    } catch (caught) {
      if (uploadedUrls.length) updateDraft((current) => ({ ...current, galleryPhotos: [...(current.galleryPhotos ?? []), ...uploadedUrls] }));
      setError(caught instanceof Error ? caught.message : "Foto galeri gagal diunggah. Coba lagi.");
    } finally {
      setUploadingGallery(false);
    }
  };

  const uploadMusicFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "audio/mpeg" || !file.name.toLowerCase().endsWith(".mp3")) { setError("Pilih file MP3."); return; }
    if (file.size > 10_000_000) { setError("Ukuran musik maksimal 10 MB."); return; }
    if (!musicRightsConfirmed) { setError("Konfirmasi bahwa kamu memiliki hak untuk menggunakan audio ini."); return; }
    if (!draft.id) { setError("Draft belum siap. Tunggu sebentar lalu coba lagi."); return; }

    setUploadingMusic(true); setError("");
    try {
      const createResponse = await fetch("/api/media/music-uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invitationId: draft.id, originalName: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const upload = await createResponse.json().catch(() => null) as { assetId?: string; uploadUrl?: string; error?: string } | null;
      if (!createResponse.ok || !upload?.assetId || !upload.uploadUrl) throw new Error(upload?.error ?? "Unggahan MP3 belum dapat dimulai.");
      const putResponse = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!putResponse.ok) throw new Error("Musik gagal diunggah. Periksa koneksi dan konfigurasi bucket.");
      const completeResponse = await fetch(`/api/media/${encodeURIComponent(upload.assetId)}/complete`, { method: "POST" });
      const completed = await completeResponse.json().catch(() => null) as { publicUrl?: string; error?: string } | null;
      if (!completeResponse.ok) throw new Error(completed?.error ?? "Musik gagal diproses.");
      const title = file.name.replace(/\.mp3$/i, "").slice(0, 80);
      const pendingTask: PendingMediaTask = { assetId: upload.assetId, kind: "music", previousUrl: draft.musicUrl, title };
      rememberPendingMedia(draft.id, pendingTask);
      const publicUrl = completed?.publicUrl ?? await waitForMediaAsset(upload.assetId);
      forgetPendingMedia(draft.id, pendingTask);
      updateDraft((current) => ({ ...current, musicUrl: publicUrl, musicTitle: title }));
      setMusicRightsConfirmed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Musik gagal diunggah. Coba lagi.");
    } finally {
      setUploadingMusic(false);
    }
  };

  const changeKind = (kind: EventKind) => {
    updateDraft((current) => {
      const titleWasSuggested = !current.eventTitle.trim()
        || Object.values(EVENT_KIND_TITLE_SUGGESTIONS).includes(current.eventTitle);
      const eventTitle = kind === "Pernikahan" || !titleWasSuggested
        ? current.eventTitle
        : EVENT_KIND_TITLE_SUGGESTIONS[kind];
      const slugSource = kind === "Pernikahan" ? `${current.hostOne} ${current.hostTwo}` : eventTitle;
      return { ...current, eventKind: kind, eventTitle, slug: slugify(slugSource) || current.slug };
    });
    setError("");
  };

  const goNext = () => {
    if (step === 0) {
      const titleReady = draft.eventKind === "Pernikahan" ? draft.hostOne.trim() && draft.hostTwo.trim() : draft.eventTitle.trim();
      if (!titleReady) {
        setError(draft.eventKind === "Pernikahan" ? "Isi nama kedua mempelai dulu." : "Isi judul acaramu dulu.");
        return;
      }
    }
    if (step === 1 && (!draft.eventDate || !draft.eventTime || !draft.venue.trim() || !draft.address.trim())) {
      setError("Lengkapi tanggal, waktu, nama tempat, dan alamat acara.");
      return;
    }
    if (step < steps.length - 1) setStep((current) => current + 1);
  };

  const handlePublish = async () => {
    const currentDraft = draftRef.current;
    const slug = slugify(currentDraft.slug);
    const validation = validateInvitationDraft({ ...currentDraft, slug });
    if (!validation.valid) {
      setError(validation.message || "Periksa kembali detail undanganmu.");
      setStep(validation.step ?? step);
      return;
    }
    setPublished(true);
    setError("");
    const savedDraft = await saveDraft(true);
    if (!savedDraft.ok) {
      setError(savedDraft.error);
      setPublished(false);
      return;
    }
    const latestDraft = savedDraft.draft;
    const latestValidation = validateInvitationDraft(latestDraft);
    if (!latestValidation.valid) {
      setError(latestValidation.message || "Periksa kembali detail undanganmu.");
      setStep(latestValidation.step ?? step);
      setPublished(false);
      return;
    }
    const response = await fetch(`/api/invitations/${encodeURIComponent(latestDraft.id)}/publish`, { method: "POST" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; checkoutUrl?: string; published?: boolean; slug?: string } | null;
    if (!response?.ok) {
      setError(result?.error ?? "Pembayaran belum dapat dimulai. Coba lagi nanti.");
      setPublished(false);
      return;
    }
    if (result?.checkoutUrl) {
      window.location.assign(result.checkoutUrl);
      return;
    }
    router.push(`/${result?.slug ?? latestDraft.slug}`);
  };

  async function saveAndReturn() {
    const result = await saveDraft(true);
    if (!result.ok) {
      setError(result.error);
      setSaveState("error");
      return;
    }
    router.push("/dashboard");
  }

  if (!hydrated) return <div className="dashboard-empty-state"><h2>Menyiapkan undanganmu...</h2><p>Menghubungkan editor ke ruang penyimpanan akun.</p></div>;

  return (
      <div className="editor-page">
        <div className="editor-heading"><div><Link className="back-link" href="/dashboard"><ArrowLeft size={15} /> Kembali ke dashboard</Link><h1>Buat undanganmu</h1><p>Isi detail kecilnya. Cerita besarnya akan terlihat dengan sendirinya.</p></div><span className="editor-save-state"><span className={saveState === "saved" ? "saved-dot" : saveState === "error" ? "saved-dot is-error" : "saved-dot is-saving"} />{saveState === "saved" ? "Tersimpan otomatis" : saveState === "error" ? "Gagal menyimpan" : "Menyimpan..."}</span></div>
        <div className="editor-stepper">{steps.map((label, index) => <button type="button" className={`stepper-step${index === step ? " is-current" : ""}${index < step ? " is-complete" : ""}`} onClick={() => { if (index <= step) setStep(index); }} key={label}><span className="stepper-number">{index < step ? <Check size={13} /> : `0${index + 1}`}</span><span>{label}</span></button>)}</div>

        <div className="editor-workspace">
          <section className="editor-form-card">
            <div className="editor-card-heading"><div><span className="eyebrow">LANGKAH 0{step + 1} DARI 05</span><h2>{["Ceritakan acaramu", "Waktu dan tempat", "Pilih foto sampul", "Pilih nuansa desain", "Lihat hasilnya"][step]}</h2><p>{["Kita mulai dari hal yang paling penting: momen apa yang ingin kamu rayakan?", "Bantu tamu tahu kapan dan di mana mereka bisa ikut merayakan.", "Tambahkan foto yang membuat undanganmu terasa semakin personal.", "Pilih template yang sesuai dengan suasana harimu.", "Semua detailmu sudah siap. Lihat kembali sebelum membagikan undangan."][step]}</p></div><div className="editor-heading-actions"><div className="editor-history-actions"><button type="button" className="editor-history-button" onClick={undoDraft} disabled={!canUndo} aria-label="Urungkan perubahan" title="Urungkan perubahan (Ctrl+Z)"><Undo2 size={15} /></button><button type="button" className="editor-history-button" onClick={redoDraft} disabled={!canRedo} aria-label="Ulangi perubahan" title="Ulangi perubahan (Ctrl+Shift+Z)"><Redo2 size={15} /></button></div><EditorFeedbackDialog invitationId={draft.id} /></div></div>

            {step === 0 && <div className="form-step-content">
              <div className="editor-field"><span className="field-label">Jenis acara</span><div className="event-kind-grid">{EVENT_KINDS.map((kind) => <button key={kind} type="button" className={`event-kind-card${draft.eventKind === kind ? " is-selected" : ""}`} onClick={() => changeKind(kind)}><span className="event-kind-icon">{eventKindIcons[kind]}</span><span>{kind}</span>{draft.eventKind === kind && <CheckCircle2 size={14} />}</button>)}</div></div>
              {draft.eventKind === "Pernikahan" ? <div className="field-row">{identityFields.filter((field) => field.key === "hostOne" || field.key === "hostTwo").map(renderSchemaField)}</div> : identityFields.filter((field) => field.key === "eventTitle").map(renderSchemaField)}
              <Field label={familyPrompt.label} hint="Informasi ini akan ditampilkan di undangan publik."><textarea className="text-input text-area" maxLength={600} rows={2} value={draft.familyDetails} onChange={(event) => update("familyDetails", event.target.value)} placeholder={familyPrompt.placeholder} /></Field>
              {identityFields.filter((field) => field.key === "story").map(renderSchemaField)}
              <div className="private-note"><Info size={15} /><span>Informasi ini ditampilkan di undanganmu. Form dasar ini dibuat dari schema template.</span></div>
            </div>}

            {step === 1 && <div className="form-step-content"><div className="schema-fields-grid">{scheduleFields.map((field) => <div className={field.type === "textarea" || field.type === "url" ? "schema-grid-item schema-grid-item--full" : "schema-grid-item"} key={field.key}>{renderSchemaField(field)}</div>)}</div><div className="editor-gift-fields"><span className="eyebrow">INFORMASI HADIAH · OPSIONAL</span><p>Detail rekening ini akan terlihat di undangan publik. Isi hanya jika ingin menerima hadiah melalui transfer.</p><div className="schema-fields-grid"><div className="schema-grid-item"><Field label="Nama bank"><input className="text-input" maxLength={80} value={draft.giftBankName} onChange={(event) => update("giftBankName", event.target.value)} placeholder="Contoh: BCA" /></Field></div><div className="schema-grid-item"><Field label="Nama pemilik rekening"><input className="text-input" maxLength={100} value={draft.giftAccountName} onChange={(event) => update("giftAccountName", event.target.value)} placeholder="Nama sesuai rekening" /></Field></div><div className="schema-grid-item schema-grid-item--full"><Field label="Nomor rekening"><input className="text-input" maxLength={60} value={draft.giftAccountNumber} onChange={(event) => update("giftAccountNumber", event.target.value)} placeholder="Masukkan nomor rekening" /></Field></div><div className="schema-grid-item schema-grid-item--full"><Field label="Pesan hadiah (opsional)"><textarea className="text-input text-area" maxLength={300} rows={2} value={draft.giftMessage} onChange={(event) => update("giftMessage", event.target.value)} placeholder="Terima kasih atas doa dan perhatianmu." /></Field></div></div></div></div>}

            {step === 2 && <div className="form-step-content"><div className={`photo-dropzone${draft.coverPhoto ? " has-photo" : ""}`} style={draft.coverPhoto ? { backgroundImage: `linear-gradient(180deg, transparent 35%, rgba(16, 25, 39, .5)), url(${draft.coverPhoto})`, backgroundPosition: `${draft.coverPositionX ?? 50}% ${draft.coverPosition}%` } : undefined}>{draft.coverPhoto ? <><span className="photo-uploaded-label"><Check size={13} /> {uploadingPhoto ? (photoToCrop ? "Menyimpan foto…" : "Menyiapkan foto…") : `${coverField?.label ?? "Foto sampul"} terpilih`}</span><div className="photo-change-actions"><button type="button" className="button button--cream button--small" disabled={uploadingPhoto} onClick={() => void editExistingPhoto()}><Pencil size={13} /> Edit foto</button><label className="button button--outline button--small">Ganti<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingPhoto} onChange={handlePhoto} /></label></div></> : <label className="photo-upload-prompt"><span className="upload-icon">{uploadingPhoto ? <Upload size={22} /> : <ImagePlus size={22} />}</span><b>{uploadingPhoto ? "Mengunggah foto…" : "Unggah foto favoritmu"}</b><small>JPG, PNG atau WebP · Maks. 5 MB</small><span className="button button--outline button--small"><Upload size={14} /> Pilih foto<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploadingPhoto} onChange={handlePhoto} /></span></label>}</div>{draft.coverPhoto && <><Field label="Atur posisi foto" hint="Geser kedua pengaturan agar wajah tetap terlihat di pratinjau ponsel dan undangan."><div className="range-row"><span>Kiri - kanan</span><input aria-label="Posisi foto kiri ke kanan" type="range" min="0" max="100" value={draft.coverPositionX ?? 50} onChange={(event) => update("coverPositionX", Number(event.target.value))} /></div><div className="range-row"><span>Atas - bawah</span><input aria-label="Posisi foto atas ke bawah" type="range" min="0" max="100" value={draft.coverPosition} onChange={(event) => update("coverPosition", Number(event.target.value))} /></div></Field><button type="button" className="remove-photo" disabled={uploadingPhoto} onClick={() => update("coverPhoto", "")}><X size={14} /> Hapus foto</button></>}<div className="private-note"><Info size={15} /><span>Foto asli dan pengaturan crop tersimpan privat. Versi WebP ditampilkan di pratinjau dan undangan.</span></div><div className="gallery-editor-section"><div className="gallery-editor-heading"><span><b>Galeri foto</b><small>Tambahkan hingga 6 foto, maksimal 5 MB per foto.</small></span><label className="button button--outline button--small">{uploadingGallery ? "Mengunggah..." : "Tambah foto"}<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploadingGallery || (draft.galleryPhotos?.length ?? 0) >= 6} onChange={(event) => void uploadGalleryFiles(event)} /></label></div>{draft.galleryPhotos?.length ? <div className="gallery-editor-grid">{draft.galleryPhotos.map((photo, index) => <div className="gallery-editor-photo" key={photo} style={{ backgroundImage: `url(${photo})` }}><span>Foto {index + 1}</span><button type="button" onClick={() => update("galleryPhotos", draft.galleryPhotos.filter((_, photoIndex) => photoIndex !== index))} aria-label={`Hapus foto galeri ${index + 1}`}><X size={13} /></button></div>)}</div> : <p className="gallery-editor-empty">Belum ada foto tambahan.</p>}</div><div className="music-editor-section"><div className="gallery-editor-heading"><span><b>Musik latar</b><small>File MP3 maksimal 10 MB · kontrol putar/jeda tampil di undangan.</small></span>{draft.musicUrl ? <button className="button button--outline button--small" type="button" disabled={uploadingMusic} onClick={() => { update("musicUrl", ""); update("musicTitle", ""); }}><X size={13} /> Hapus musik</button> : <label className="button button--outline button--small">{uploadingMusic ? "Mengunggah..." : "Pilih MP3"}<input type="file" accept="audio/mpeg,.mp3" disabled={uploadingMusic} onChange={(event) => void uploadMusicFile(event)} /></label>}</div>{draft.musicUrl ? <p className="music-selected"><Music2 size={14} /> {draft.musicTitle || "Musik latar terpilih"}</p> : <><label className="music-rights-check"><input type="checkbox" checked={musicRightsConfirmed} onChange={(event) => setMusicRightsConfirmed(event.target.checked)} /><span>Saya memiliki hak atau izin untuk memakai audio ini pada undangan publik.</span></label><p className="gallery-editor-empty">Gunakan musik yang kamu buat sendiri atau yang lisensinya mengizinkan penggunaan publik.</p></>}</div></div>}

            {step === 3 && <div className="form-step-content"><div className="theme-choice-grid">{templateChoices.map((template) => <button className={`theme-choice${draft.templateId === template.slug ? " is-selected" : ""}`} key={template.slug} type="button" onClick={() => updateDraft((current) => ({ ...current, templateId: template.slug, templateVersion: template.version }))}><span className={`theme-swatch theme-swatch--${template.style}`}><i /><i /><i /></span><span className="theme-choice-copy"><b>{template.name}</b><small>{template.subtitle}</small><small className="theme-price">{formatRupiah(template.price)}</small></span><span className="theme-choice-check">{draft.templateId === template.slug && <Check size={13} />}</span></button>)}</div><div className="personalization-controls"><fieldset className="personalization-control"><legend>Warna aksen</legend><div className="personalization-choice-list">{themeColorOptions.map((color) => <button key={color.value} type="button" className={(draft.themeColor ?? "default") === color.value ? "is-selected" : ""} onClick={() => update("themeColor", color.value)} aria-pressed={(draft.themeColor ?? "default") === color.value}><span className="personalization-color-swatch" style={{ backgroundColor: color.swatch || (activeTemplate.style === "sage" ? "#7b9278" : activeTemplate.style === "cream" ? "#b08c6c" : "#b8935e") }} /><small>{color.label}</small></button>)}</div></fieldset><fieldset className="personalization-control"><legend>Font</legend><div className="personalization-choice-list">{themeFontOptions.map((font) => <button key={font.value} type="button" className={(draft.themeFont ?? "classic") === font.value ? "is-selected" : ""} onClick={() => update("themeFont", font.value)} aria-pressed={(draft.themeFont ?? "classic") === font.value}><span className={`personalization-font-sample is-${font.value}`}>Aa</span><small>{font.label}</small></button>)}</div></fieldset><fieldset className="personalization-control"><legend>Urutan informasi</legend><div className="personalization-order-list">{sectionOrderOptions.map((order) => <button key={order.value} type="button" className={(draft.sectionOrder ?? "story-first") === order.value ? "is-selected" : ""} onClick={() => update("sectionOrder", order.value)} aria-pressed={(draft.sectionOrder ?? "story-first") === order.value}>{order.label}</button>)}</div></fieldset></div><Field label="Tautan undangan"><div className="slug-input"><span>tamukita.io/</span><input value={draft.slug} disabled={draft.isPublished} onChange={(event) => update("slug", slugify(event.target.value))} aria-label="Nama tautan undangan" aria-invalid={!slugIsAvailable} /><span className={`slug-status${slugIsAvailable ? "" : " is-unavailable"}`}>{draft.isPublished ? "tetap aktif" : slugIsAvailable ? <><Check size={13} /> tersedia</> : <>tidak tersedia</>}</span></div></Field><p className="field-hint slug-hint">{draft.isPublished ? "Tautan yang sudah dibagikan tetap aktif saat kamu memperbarui detail undangan." : "Gunakan 3 karakter atau lebih. Tautan khusus seperti /admin dan /dashboard tidak tersedia."}</p><div className="custom-domain-note"><span className="domain-globe">◎</span><span><b>Ingin pakai domain sendiri?</b><small>Custom domain akan segera hadir.</small></span><span className="coming-soon-pill">SEGERA</span></div></div>}

            {step === 4 && <div className="form-step-content final-step-content"><div className="review-summary"><span className="review-check"><CheckCircle2 size={20} /></span><div><b>Undanganmu siap untuk dibagikan</b><small>{activeTemplate.price === 0 ? "Template gratis akan langsung diterbitkan." : "Detail terbit setelah pembayaran template berhasil dikonfirmasi."}</small></div></div><div className="review-line"><span>Jenis acara</span><b>{draft.eventKind}</b></div><div className="review-line"><span>Nama / judul</span><b>{draft.eventKind === "Pernikahan" ? `${draft.hostOne} & ${draft.hostTwo}` : draft.eventTitle}</b></div><div className="review-line"><span>Tanggal</span><b>{formatShortDate(draft.eventDate)}</b></div><div className="review-line"><span>Template</span><b>{templateChoices.find((template) => template.slug === draft.templateId)?.name}</b></div><div className="demo-payment-notice"><span className="demo-notice-icon"><Info size={15} /></span><span><b>{formatRupiah(activeTemplate.price)}</b><small>{activeTemplate.price === 0 ? "Tanpa biaya lisensi template." : "Pembayaran satu kali untuk lisensi template undangan ini."}</small></span></div>{published && <div className="publish-success"><CheckCircle2 size={16} /> Membuka halaman undangan...</div>}</div>}

            {error && <div className="editor-error" role="alert"><Info size={15} />{error}</div>}
            <div className="editor-card-footer"><button type="button" className="draft-later" onClick={saveAndReturn}><Save size={15} /> Simpan & lanjutkan nanti</button><div className="step-navigation">{step > 0 && <button type="button" className="button button--outline button--small" onClick={() => { setStep((current) => current - 1); setError(""); }}><ChevronLeft size={15} /> Kembali</button>}{step < 4 ? <button type="button" className="button button--dark button--small" onClick={goNext}>{step === 3 ? "Lihat preview" : "Lanjutkan"} <ChevronRight size={15} /></button> : <button type="button" className="button button--dark button--small" onClick={handlePublish} disabled={published}>{published ? "Menghubungkan..." : "Bayar & terbitkan"} <ArrowRight size={15} /></button>}</div></div>
          </section>

          <aside className="editor-preview-panel"><div className="editor-preview-heading"><div><span className="eyebrow">LIVE PREVIEW</span><h3>Pratinjau undangan</h3></div><fieldset className="preview-device-switch" aria-label="Tampilan pratinjau"><button type="button" className={previewDevice === "mobile" ? "is-selected" : ""} onClick={() => setPreviewDevice("mobile")} aria-pressed={previewDevice === "mobile"}><Smartphone size={12} /> Ponsel</button><button type="button" className={previewDevice === "desktop" ? "is-selected" : ""} onClick={() => setPreviewDevice("desktop")} aria-pressed={previewDevice === "desktop"}><Monitor size={12} /> Desktop</button></fieldset></div><div className={`preview-phone-stage${previewDevice === "desktop" ? " is-desktop" : ""}`}><div className={`preview-phone${previewDevice === "desktop" ? " is-desktop" : ""}`}>{previewDevice === "mobile" && <div className="preview-phone-camera" />}<InvitationPreview draft={draft} template={activeTemplate} /></div></div><div className="preview-link-row"><span className="preview-link-icon">↗</span><span><small>Tautan undangan</small><b>tamukita.io/{draft.slug || "namaundangan"}</b></span><button type="button" onClick={() => navigator.clipboard?.writeText(`https://tamukita.io/${draft.slug}`)} aria-label="Salin tautan"><Check size={15} /></button></div><div className="preview-reminder"><Sparkles size={15} /><span>Perubahanmu tersimpan otomatis. Kamu bisa kembali dan melanjutkan kapan saja.</span></div></aside>
        </div>
        <div className="editor-bottom-tip"><span><RotateCcw size={14} /> Kamu bisa mengedit undangan setelah diterbitkan.</span><Link href="/templates">Butuh inspirasi template? <ArrowRight size={14} /></Link></div>
        {photoToCrop && <div className="modal-backdrop photo-crop-backdrop" role="presentation"><section className="photo-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="photo-crop-title"><div className="photo-crop-heading"><div><span className="eyebrow">EDIT FOTO SAMPUL</span><h2 id="photo-crop-title">Sesuaikan fotomu</h2><p>Geser foto di dalam bingkai, atur zoom, atau putar sebelum disimpan.</p></div><button type="button" className="modal-close" onClick={() => setPhotoToCrop(null)} disabled={uploadingPhoto} aria-label="Tutup"><X size={18} /></button></div><div className="photo-crop-stage"><Cropper image={photoToCrop.previewUrl} crop={crop} zoom={zoom} rotation={rotation} initialCroppedAreaPixels={photoToCrop.initialArea} aspect={3 / 4} minZoom={1} maxZoom={3} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)} /></div><div className="photo-crop-controls"><label className="photo-crop-zoom"><span>Perbesar foto</span><input aria-label="Perbesar foto" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label><div className="photo-crop-rotate"><span>Putar</span><button type="button" className="button button--outline button--small" disabled={uploadingPhoto} onClick={() => setRotation((value) => (value + 270) % 360)}><RotateCcw size={14} /> 90°</button><button type="button" className="button button--outline button--small" disabled={uploadingPhoto} onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCw size={14} /> 90°</button></div></div>{error && <div className="editor-error" role="alert">{error}</div>}<div className="photo-crop-footer"><button type="button" className="button button--outline button--small" disabled={uploadingPhoto} onClick={() => setPhotoToCrop(null)}>Batal</button><button type="button" className="button button--outline button--small" disabled={uploadingPhoto} onClick={resetPhotoCrop}><RotateCcw size={14} /> Atur ulang</button><button type="button" className="button button--dark button--small" disabled={uploadingPhoto || !croppedAreaPixels} onClick={() => void uploadCroppedPhoto()}>{uploadingPhoto ? "Menyimpan foto…" : "Gunakan foto"} <Check size={14} /></button></div></section></div>}
      </div>
  );
}
