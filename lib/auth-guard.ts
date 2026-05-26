import { auth } from '@/auth';

export async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('UNAUTHORIZED');
  return session;
}
export async function getIsAdmin() {
  const session = await auth();
  return session?.user?.role === 'ADMIN';
}
