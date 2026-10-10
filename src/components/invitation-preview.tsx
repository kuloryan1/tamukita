import { getTemplateRenderer } from "@/templates/registry";
import type { InvitationDraft } from "@/lib/invitations";
import type { Template } from "@/lib/template-sdk";

export function InvitationPreview({ draft, full = false, recipientName, template: templateOverride, mode = "editor" }: { draft: InvitationDraft; full?: boolean; recipientName?: string; template?: Template; mode?: "editor" | "public" | "example" }) {
  const template = templateOverride;
  const Renderer = getTemplateRenderer(template?.slug ?? draft.templateId, draft.templateVersion || template?.version || "1.0.0");
  return (
    <div className="invitation-preview-theme" data-theme-color={draft.themeColor ?? "default"} data-theme-font={draft.themeFont ?? "classic"} data-section-order={draft.sectionOrder ?? "story-first"}>
      <Renderer draft={draft} full={full} recipientName={recipientName} mode={mode} template={template} />
    </div>
  );
}
