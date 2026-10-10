import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    platformRole: string;
    authVersion: number;
  }

  interface Session {
    user: {
      id: string;
      platformRole: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    platformRole?: string;
    authVersion?: number;
  }
}
