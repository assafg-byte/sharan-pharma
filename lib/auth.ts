import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        phone4: { label: "4 ספרות אחרונות", type: "text" },
        password: { label: "סיסמה", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.phone4 || !credentials?.password) return null;
        const employee = await prisma.employee.findFirst({
          where: { phone4: credentials.phone4, archived: false },
        });
        if (!employee || !employee.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, employee.passwordHash);
        if (!ok) return null;
        return {
          id: String(employee.id),
          name: employee.name,
          email: `${employee.id}@moked`,
          role: employee.role,
          employeeId: employee.id,
          gender: employee.gender,
          employeeType: employee.employeeType,
        };
      },
    }),
  ],
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async jwt({ token, user }: { token: any; user: any }) {
      if (user) {
        token.role = user.role;
        token.employeeId = user.employeeId;
        token.gender = user.gender;
        token.employeeType = user.employeeType;
      }
      return token;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.employeeId = token.employeeId;
        session.user.gender = token.gender;
        session.user.employeeType = token.employeeType;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" as const },
  secret: process.env.NEXTAUTH_SECRET, // no fallback — next-auth refuses to start without it
};
