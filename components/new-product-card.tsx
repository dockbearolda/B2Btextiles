'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useEditMode } from './edit-mode-provider';
import { createProduct } from '@/lib/actions/product';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

export function NewProductCard({ genreId, genreSlug }: { genreId: string; genreSlug: string }) {
  const { editing } = useEditMode();
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!editing) return null;
  function add() {
    start(async () => {
      try { const r = await createProduct(genreId); router.push(`/catalogue/${genreSlug}/${r.slug}`); }
      catch { toast.error('Échec de la création'); }
    });
  }
  return (
    <button onClick={add} disabled={pending} style={{
      border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-4)', color: 'var(--brand-duck)',
      display: 'grid', placeItems: 'center', minHeight: 180, gap: 6, background: 'transparent', cursor: 'pointer',
    }}>
      <Plus size={22} /> Nouveau produit
    </button>
  );
}
