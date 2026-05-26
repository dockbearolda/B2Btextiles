'use client';
import { useState, useTransition } from 'react';
import { useEditMode } from './edit-mode-provider';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export function NewEntityCard({
  label, onCreate, asRow = false,
}: { label: string; onCreate: (name: string) => Promise<unknown>; asRow?: boolean }) {
  const { editing } = useEditMode();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  if (!editing) return null;

  function submit() {
    const v = name.trim();
    if (!v) return;
    start(async () => {
      try { await onCreate(v); setName(''); setOpen(false); toast.success('Créé'); }
      catch (e) { toast.error(e instanceof Error ? e.message : 'Échec'); }
    });
  }
  const box: React.CSSProperties = {
    border: '1px dashed var(--brand-duck-300)', borderRadius: asRow ? 'var(--r-2)' : 'var(--r-4)',
    color: 'var(--brand-duck)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
    padding: asRow ? '8px 10px' : 16, background: 'transparent', width: '100%',
  };
  if (!open) return <button style={box} onClick={() => setOpen(true)}><Plus size={16} /> {label}</button>;
  return (
    <div style={{ ...box, cursor: 'default', flexDirection: asRow ? 'row' : 'column', alignItems: 'stretch' }}>
      <input autoFocus value={name} placeholder={label} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        style={{ font: 'inherit', padding: 6, border: '1px solid var(--brand-sage)', borderRadius: 'var(--r-2)' }} />
      <div style={{ display: 'flex', gap: 6, marginTop: asRow ? 0 : 8 }}>
        <button onClick={submit} disabled={pending} style={{ flex: 1, padding: 6, border: 0, borderRadius: 'var(--r-2)', background: 'var(--brand-duck)', color: '#fff' }}>OK</button>
        <button onClick={() => setOpen(false)} style={{ padding: 6, border: 0, borderRadius: 'var(--r-2)', background: 'var(--brand-linen)' }}>Annuler</button>
      </div>
    </div>
  );
}
