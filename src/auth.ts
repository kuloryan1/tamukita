import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { getPrismaClient } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { allowRequest } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        if (!await allowRequest(`login:${parsed.data.email}`, 20, 15 * 60)) {
          await verifyPassword(parsed.data.password, null);
          return null;
        }

        const prisma = getPrismaClient();
        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            passwordHash: true,
            platformRole: true,
            authVersion: true,
            failedLoginAttempts: true,
            lockedUntil: true,
          },
        });
        const passwordMatches = await verifyPassword(parsed.data.password, user?.passwordHash);
        if (!user?.passwordHash) return null;

        const now = new Date();
        if (user.lockedUntil && user.lockedUntil > now) return null;
        if (user.lockedUntil && user.lockedUntil <= now) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        if (!passwordMatches) {
          await prisma.$transaction(async (tx) => {
            const result = await tx.user.update({
              where: { id: user.id },
              data: { failedLoginAttempts: { increment: 1 } },
              select: { failedLoginAttempts: true },
            });
            if (result.failedLoginAttempts >= 5) {
              await tx.user.update({
                where: { id: user.id },
                data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
              });
            }
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null },
        });
        if (!user.emailVerified) return null;
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          platformRole: user.platformRole,
          authVersion: user.authVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.platformRole = "platformRole" in user ? user.platformRole : "CUSTOMER";
        token.authVersion = "authVersion" in user ? Number(user.authVersion) : undefined;
      }
      if (token.id) {
        const currentUser = await getPrismaClient().user.findUnique({ where: { id: String(token.id) }, select: { authVersion: true, emailVerified: true } });
        if (!currentUser?.emailVerified || token.authVersion !== currentUser.authVersion) {
          token.id = "";
          delete token.platformRole;
          delete token.authVersion;
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.platformRole = String(token.platformRole ?? "CUSTOMER");
      }
      return session;
    },
  },
});
