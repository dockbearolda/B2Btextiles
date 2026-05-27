'use client';
import { useActionState } from 'react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, action, pending] = useActionState(loginAction, null);
  return (
    <main style={{ maxWidth: 360, margin: '12vh auto', padding: 24 }}>
      <h1 style={{ color: 'var(--fg-1)', marginBottom: 16 }}>Connexion</h1>
      <form action={action} style={{ display: 'grid', gap: 12 }}>
        <input name="email" type="text" placeholder="Identifiant" required
          style={{ padding: 10, borderRadius: 'var(--r-3)', border: '1px solid var(--brand-sage)' }} />
        <input name="password" type="password" placeholder="Mot de passe" required
          style={{ padding: 10, borderRadius: 'var(--r-3)', border: '1px solid var(--brand-sage)' }} />
        <button type="submit" disabled={pending}
          style={{ padding: 10, borderRadius: 'var(--r-3)', background: 'var(--brand-duck)', color: '#fff', border: 0 }}>
          {pending ? '…' : 'Se connecter'}
        </button>
        {error && <p style={{ color: '#b00020', fontSize: 13 }}>{error}</p>}
      </form>
    </main>
  );
}
