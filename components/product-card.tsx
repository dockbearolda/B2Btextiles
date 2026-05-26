'use client';
import Link from 'next/link';
import { useTransition } from 'react';
import { useEditMode } from './edit-mode-provider';
import { deleteProduct } from '@/lib/actions/product';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

export type CardProduct = {
  id: string; slug: string; designation: string; prix: string; refInterne: string | null; genreSlug: string;
};

export function ProductCard({ p }: { p: CardProduct }) {
  const { editing } = useEditMode();
  const [pending, start] = useTransition();
  function remove(e: React.MouseEvent) {
    e.preventDefault();
    if (!confirm('Supprimer ce produit ?')) return;
    start(async () => { try { await deleteProduct(p.id); toast.success('Supprimé'); } catch { toast.error('Échec'); } });
  }
  return (
    <Link href={`/catalogue/${p.genreSlug}/${p.slug}`} style={{
      position: 'relative', display: 'block', textDecoration: 'none', color: 'var(--fg-2)',
      border: '1px solid var(--brand-sage)', borderRadius: 'var(--r-4)', padding: 14, background: '#fff', boxShadow: 'var(--shadow-1)',
    }}>
      <div style={{ aspectRatio: '4 / 3', borderRadius: 'var(--r-3)', background: 'var(--brand-linen)', marginBottom: 10 }} />
      <strong style={{ color: 'var(--fg-1)' }}>{p.designation}</strong>
      <div className="micro-label" style={{ marginTop: 4 }}>{p.refInterne ?? ''}</div>
      <div style={{ marginTop: 6, fontWeight: 600 }}>{p.prix} €</div>
      {editing && (
        <button onClick={remove} disabled={pending} title="Supprimer"
          style={{ position: 'absolute', top: 8, right: 8, border: 0, borderRadius: 'var(--r-2)', padding: 6, background: '#fff', color: '#b00020', boxShadow: 'var(--shadow-1)' }}>
          <Trash2 size={15} />
        </button>
      )}
    </Link>
  );
}
