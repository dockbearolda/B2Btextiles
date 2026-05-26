import { auth } from '@/auth';

// Throws on non-admin — intended for Server Actions / Route Handlers, where the
// thrown error becomes a failed mutation. For page Server Components, redirect
// to '/login' instead so the visitor gets the login screen, not an error page.
export async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('UNAUTHORIZED');
  return session;
}
export async function getIsAdmin() {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}
