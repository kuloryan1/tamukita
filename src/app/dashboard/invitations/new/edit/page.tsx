import type { Metadata } from "next";
import { InvitationEditor } from "@/components/editor";
import { auth } from "@/auth";
import { getListedTemplateCatalog } from "@/lib/template-catalog";

export const metadata: Metadata = { title: "Buat undangan" };
export const dynamic = "force-dynamic";

export default async function EditInvitationPage() {
  const [session, templateCatalog] = await Promise.all([auth(), getListedTemplateCatalog()]);
  if (!templateCatalog.length) {
    return <div className="dashboard-empty-state"><h2>Template sedang disiapkan</h2><p>Silakan kembali lagi setelah katalog diperbarui.</p></div>;
  }
  return <InvitationEditor templateCatalog={templateCatalog} isSuperAdmin={session?.user?.platformRole === "SUPER_ADMIN"} />;
}
