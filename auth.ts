import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verify } from '@node-rs/argon2';

// `email` holds a free-form identifier (login can be a username like "loic", not only an email).
const credsSchema = z.object({ email: z.string().min(1), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // Railway: request host may differ from the configured URL

  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await verify(user.passwordHash, password);
        if (!ok) return null;
        return { id: user.id, email: user.email, role: 'ADMIN' as const };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = 'ADMIN';
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.role = token.role as 'ADMIN' | undefined;
      return session;
    },
  },
});
