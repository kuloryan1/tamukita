import type { Metadata } from "next";
import { InvitationEditor } from "@/components/editor";
import { auth } from "@/auth";
import { getPublishedTemplateCatalog } from "@/lib/template-catalog";

export const metadata: Metadata = { title: "Buat undangan" };
export const dynamic = "force-dynamic";

export default async function EditInvitationPage() {
  const [session, templateCatalog] = await Promise.all([auth(), getPublishedTemplateCatalog()]);
  return <InvitationEditor templateCatalog={templateCatalog} isSuperAdmin={session?.user?.platformRole === "SUPER_ADMIN"} />;
}
