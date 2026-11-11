import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuestManager } from "@/components/guest-manager";
import { getPrismaClient } from "@/lib/prisma";
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";

export const metadata: Metadata = { title: "Daftar tamu" };

export default async function InvitationGuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: { id, ownerId: userId, deletedAt: null, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
    select: { id: true, slug: true, title: true, status: true },
  });
  if (!invitation) notFound();
  const featureAccess = await getInvitationFeatureAccess(invitation.id);
  if (!featureAccess.rsvp) notFound();
  const responses = await prisma.rSVP.findMany({
    where: { invitationId: invitation.id },
    orderBy: { respondedAt: "desc" },
    take: 500,
    select: { id: true, displayName: true, attendance: true, attendeeCount: true, respondedAt: true },
  });
  const recentResponses = responses.map((response) => ({ ...response, respondedAt: response.respondedAt.toISOString() }));
  return <GuestManager invitationId={invitation.id} slug={invitation.slug} eventTitle={invitation.title} isPublished={invitation.status === "PUBLISHED"} initialResponses={recentResponses} />;
}
