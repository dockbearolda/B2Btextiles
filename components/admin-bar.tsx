'use client';
import { useEditMode } from './edit-mode-provider';
import { signOutAction } from '@/lib/actions/session';
import { Pencil, Eye, LogOut } from 'lucide-react';

export function AdminBar() {
  const { isAdmin, editing, setEditing } = useEditMode();
  if (!isAdmin) return null;
  return (
    <div style={{
      position: 'fixed', right: 16, bottom: 16, zIndex: 50, display: 'flex', gap: 8,
      background: '#fff', padding: 8, borderRadius: 'var(--r-5)', boxShadow: '0 4px 16px rgba(74,98,116,0.18)',
    }}>
      <button onClick={() => setEditing(!editing)} title="Mode édition"
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 'var(--r-3)',
          border: 0, background: editing ? 'var(--brand-duck)' : 'var(--brand-linen)', color: editing ? '#fff' : 'var(--fg-2)' }}>
        {editing ? <Pencil size={16} /> : <Eye size={16} />}
        {editing ? 'Édition' : 'Lecture'}
      </button>
      <form action={signOutAction}>
        <button type="submit" title="Déconnexion"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 'var(--r-3)', border: 0, background: 'var(--brand-linen)', color: 'var(--fg-2)' }}>
          <LogOut size={16} /> Quitter
        </button>
      </form>
    </div>
  );
}
