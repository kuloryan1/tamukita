import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuestManager } from "@/components/guest-manager";
import { getPrismaClient } from "@/lib/prisma";

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
    select: { id: true, slug: true },
  });
  if (!invitation) notFound();
  const [links, responses] = await Promise.all([
    prisma.guestLink.findMany({
      where: { invitationId: invitation.id },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { guest: { select: { id: true, name: true, rsvps: { where: { invitationId: invitation.id }, orderBy: { respondedAt: "desc" }, take: 1, select: { attendance: true, attendeeCount: true, respondedAt: true } } } } },
    }),
    prisma.rSVP.findMany({
      where: { invitationId: invitation.id },
      orderBy: { respondedAt: "desc" },
      take: 500,
      select: { id: true, displayName: true, attendance: true, attendeeCount: true, respondedAt: true },
    }),
  ]);
  const guests = links.map(({ guest }) => ({
    id: guest.id,
    name: guest.name,
    rsvp: guest.rsvps[0] ? { ...guest.rsvps[0], respondedAt: guest.rsvps[0].respondedAt.toISOString() } : null,
  }));
  const recentResponses = responses.map((response) => ({ ...response, respondedAt: response.respondedAt.toISOString() }));
  return <GuestManager invitationId={invitation.id} slug={invitation.slug} initialGuests={guests} initialResponses={recentResponses} />;
}
