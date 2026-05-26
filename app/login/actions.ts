'use server';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { hit } from '@/lib/rate-limit';

export async function loginAction(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get('email') ?? '');
  if (!hit(`login:${email}`, 8, 60_000)) return 'Trop de tentatives, réessayez dans une minute.';
  try {
    await signIn('credentials', {
      email,
      password: String(formData.get('password') ?? ''),
      redirectTo: '/catalogue',
    });
    return null;
  } catch (e) {
    if (e instanceof AuthError) return 'Identifiants invalides.';
    throw e; // let the NEXT_REDIRECT propagate
  }
}
