import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitationEditor } from "@/components/editor";
import { auth } from "@/auth";
import { getPublishedTemplateCatalog } from "@/lib/template-catalog";

export const metadata: Metadata = { title: "Edit undangan" };
export const dynamic = "force-dynamic";

export default async function EditInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) notFound();
  const [session, templateCatalog] = await Promise.all([auth(), getPublishedTemplateCatalog()]);
  return <InvitationEditor key={id} invitationId={id} templateCatalog={templateCatalog} isSuperAdmin={session?.user?.platformRole === "SUPER_ADMIN"} />;
}
