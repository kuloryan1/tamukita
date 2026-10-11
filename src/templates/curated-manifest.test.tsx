import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { createInitialDraft } from "@/lib/invitations";
import { templates } from "@/lib/templates";
import { CuratedManifestTemplate } from "@/templates/curated-manifest";

test("renders only populated fields declared by the manifest and escapes their values", () => {
  const template = structuredClone(templates[0]);
  template.schema.sections.find((section) => section.key === "identity")?.fields.push({
    key: "welcomeNote",
    type: "textarea",
    label: "Pesan pembuka",
  });
  const markup = renderToStaticMarkup(
    <CuratedManifestTemplate
      draft={{
        ...createInitialDraft(),
        customFields: {
          welcomeNote: "<script>alert(1)</script>",
          undeclaredValue: "Field yang tidak ada di manifest",
        },
      }}
      mode="public"
      template={template}
    />,
  );

  expect(markup).toContain("Pesan pembuka");
  expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(markup).not.toContain("<script>");
  expect(markup).not.toContain("Field yang tidak ada di manifest");
});
