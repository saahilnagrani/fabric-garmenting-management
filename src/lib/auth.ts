import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import type { UserRole, InventoryRole, SourcingRole } from "@/generated/prisma/client";

declare module "next-auth" {
  interface User {
    role?: UserRole;
    inventoryRole?: InventoryRole | null;
    sourcingRole?: SourcingRole | null;
    permissionOverrides?: string[];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          inventoryRole: user.inventoryRole,
          sourcingRole: user.sourcingRole,
          permissionOverrides: user.permissionOverrides,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.inventoryRole = user.inventoryRole;
        token.sourcingRole = user.sourcingRole;
        token.permissionOverrides = user.permissionOverrides;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.inventoryRole = token.inventoryRole as InventoryRole | null;
        session.user.sourcingRole = token.sourcingRole as SourcingRole | null;
        session.user.permissionOverrides = token.permissionOverrides as string[];
      }
      return session;
    },
  },
});
