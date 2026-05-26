import type { DefaultSession } from 'next-auth';
declare module 'next-auth' {
  interface Session {
    user: { role?: 'ADMIN' | undefined } & DefaultSession['user'];
  }
  interface User { role?: 'ADMIN' }
}
declare module 'next-auth/jwt' {
  interface JWT { role?: 'ADMIN' | undefined }
}
