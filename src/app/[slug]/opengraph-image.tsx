import { ImageResponse } from "next/og";
import { createDemoDraft, isBuiltInDemoSlug, type InvitationDraft } from "@/lib/invitations";
import { parseInvitationDraft } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { isEditorCompatibleTemplate, validateTemplateManifest } from "@/lib/template-sdk";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Pratinjau undangan digital TamuKita";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let draft: InvitationDraft | null = null;
  const invitation = process.env.DATABASE_URL || !isBuiltInDemoSlug(slug)
    ? await getPrismaClient().invitation.findFirst({
      where: {
        slug,
        status: "PUBLISHED",
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        organization: { status: "ACTIVE" },
      },
      select: {
        publishedSnapshot: true,
        templateVersion: { select: { version: true, manifest: true, template: { select: { slug: true } } } },
      },
    })
    : null;
  if (invitation) {
    const publishedDraft = parseInvitationDraft(invitation.publishedSnapshot);
    const manifest = validateTemplateManifest(invitation.templateVersion.manifest);
    const template = manifest.success
      && manifest.data.slug === invitation.templateVersion.template.slug
      && manifest.data.version === invitation.templateVersion.version
      && isEditorCompatibleTemplate(manifest.data)
      ? manifest.data
      : getTemplate(invitation.templateVersion.template.slug);
    if (!publishedDraft || publishedDraft.templateId !== invitation.templateVersion.template.slug || !template) {
      if (!isBuiltInDemoSlug(slug)) return new Response("Undangan tidak ditemukan.", { status: 404 });
    } else {
      draft = publishedDraft;
    }
  }
  if (!draft && isBuiltInDemoSlug(slug)) draft = { ...createDemoDraft(), slug };
  if (!draft) return new Response("Undangan tidak ditemukan.", { status: 404 });

  const title = draft.eventKind === "Pernikahan"
    ? `${draft.hostOne} & ${draft.hostTwo}`.trim()
    : draft.eventTitle || draft.eventKind;
  const shortTitle = title.length > 70 ? `${title.slice(0, 67).trim()}…` : title;
  const eventDate = draft.eventDate
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${draft.eventDate}T00:00:00`))
    : "Sebuah hari istimewa";
  const accent = draft.themeColor === "rose" ? "#b8758a" : draft.themeColor === "ocean" ? "#6d91a8" : "#b8935e";

  return new ImageResponse(
    (
      <div style={{ alignItems: "center", background: "linear-gradient(135deg, #f7f4ee 0%, #fbfaf7 56%, #e6ebe3 100%)", color: "#27372e", display: "flex", height: "100%", justifyContent: "space-between", overflow: "hidden", padding: "58px 68px", position: "relative", width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 600, position: "relative", zIndex: 1 }}>
          <span style={{ color: accent, fontFamily: "Arial, sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: 5 }}>TAMUKITA · UNDANGAN DIGITAL</span>
          <h1 style={{ color: "#30443a", fontFamily: "Georgia, Times New Roman, serif", fontSize: 66, fontWeight: 400, letterSpacing: -2, lineHeight: 1.08, margin: "28px 0 20px", maxWidth: 590 }}>{shortTitle}</h1>
          <div style={{ background: accent, height: 3, marginBottom: 22, width: 76 }} />
          <p style={{ color: "#68756b", fontFamily: "Arial, sans-serif", fontSize: 27, margin: 0 }}>{eventDate}</p>
          <span style={{ color: "#92988f", fontFamily: "Arial, sans-serif", fontSize: 19, marginTop: 38 }}>tamukita.io/{slug}</span>
        </div>
        <div style={{ alignItems: "center", background: "rgba(255,255,255,.8)", border: "1px solid #e5e5dc", borderRadius: 26, boxShadow: "0 22px 70px rgba(46,58,48,.12)", display: "flex", flexDirection: "column", height: 482, justifyContent: "center", overflow: "hidden", padding: 34, position: "relative", width: 345 }}>
          <div style={{ background: accent, borderRadius: 999, height: 7, marginBottom: 32, opacity: .65, width: 68 }} />
          <span style={{ color: "#7c857b", fontFamily: "Arial, sans-serif", fontSize: 16, letterSpacing: 4, textAlign: "center" }}>HARI YANG DINANTIKAN</span>
          <strong style={{ color: "#384c40", fontFamily: "Georgia, Times New Roman, serif", fontSize: 35, fontWeight: 400, lineHeight: 1.15, marginTop: 20, textAlign: "center" }}>{shortTitle}</strong>
          <div style={{ background: "#e7ebe3", height: 1, margin: "30px 0", width: "100%" }} />
          <span style={{ color: accent, fontFamily: "Arial, sans-serif", fontSize: 19, textAlign: "center" }}>{eventDate}</span>
          <span style={{ color: "#8b938a", fontFamily: "Arial, sans-serif", fontSize: 16, marginTop: 10, textAlign: "center" }}>Dengan penuh sukacita, kami mengundang Anda.</span>
          <div style={{ background: accent, borderRadius: "50%", height: 170, opacity: .08, position: "absolute", right: -65, top: -65, width: 170 }} />
        </div>
        <div style={{ background: accent, borderRadius: "50%", bottom: -220, height: 450, opacity: .08, position: "absolute", right: 240, width: 450 }} />
      </div>
    ),
    size,
  );
}
