import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <DashboardShell user={{ name: session.user.name ?? null, email: session.user.email ?? null, platformRole: session.user.platformRole }}>{children}</DashboardShell>;
}
