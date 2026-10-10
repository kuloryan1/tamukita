import type { Metadata } from "next";
import { InvitationEditor } from "@/components/editor";
import { getPublishedTemplateCatalog } from "@/lib/template-catalog";

export const metadata: Metadata = { title: "Buat undangan" };
export const dynamic = "force-dynamic";

export default async function EditInvitationPage() {
  const templateCatalog = await getPublishedTemplateCatalog();
  return <InvitationEditor templateCatalog={templateCatalog} />;
}
