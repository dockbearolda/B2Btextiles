'use client';
import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useEditMode } from './edit-mode-provider';
import { deleteProductImage, setPrimaryImage, moveProductImage } from '@/lib/actions/product-image';
import { toast } from 'sonner';
import { Star, Trash2, ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react';

type Img = { id: string; url: string; thumbUrl: string; width: number; height: number; position: number };

const ctrlBtn: React.CSSProperties = {
  display: 'grid', placeItems: 'center', width: 22, height: 22, padding: 0,
  border: '1px solid var(--brand-sage)', borderRadius: 'var(--r-1)', background: '#fff', cursor: 'pointer',
};

export function ProductGallery({ productId, images }: { productId: string; images: Img[] }) {
  const { editing } = useEditMode();
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const main = images[active] ?? images[0];

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append('files', f));
    setUploading(true);
    try {
      const res = await fetch(`/api/products/${productId}/images`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Échec');
      toast.success('Photos ajoutées');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Échec de l’upload');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function act(fn: () => Promise<unknown>, okMsg?: string) {
    start(async () => {
      try {
        await fn();
        if (okMsg) toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Échec');
      }
    });
  }

  const frame: React.CSSProperties = {
    aspectRatio: '4 / 3', borderRadius: 'var(--r-5)', background: 'var(--brand-linen)',
    overflow: 'hidden', display: 'grid', placeItems: 'center',
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={frame}>
        {main ? (
          <img src={main.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span className="micro-label">Aucune photo</span>
        )}
      </div>

      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((img, i) => (
            <div key={img.id} style={{ display: 'grid', gap: 2 }}>
              <button
                onClick={() => setActive(i)}
                aria-label={`Photo ${i + 1}`}
                style={{
                  border: i === active ? '2px solid var(--brand-duck)' : '1px solid var(--brand-sage)',
                  borderRadius: 'var(--r-2)', padding: 0, width: 64, height: 48, overflow: 'hidden', background: 'none', cursor: 'pointer',
                }}
              >
                <img src={img.thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
              {editing && (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <button title="Reculer" disabled={pending} onClick={() => act(() => moveProductImage(img.id, 'up'))} style={ctrlBtn}><ChevronLeft size={12} /></button>
                  <button title="Définir principale" disabled={pending} onClick={() => act(() => setPrimaryImage(img.id), 'Principale définie')} style={ctrlBtn}><Star size={12} /></button>
                  <button title="Avancer" disabled={pending} onClick={() => act(() => moveProductImage(img.id, 'down'))} style={ctrlBtn}><ChevronRight size={12} /></button>
                  <button title="Supprimer" disabled={pending} onClick={() => act(() => deleteProductImage(img.id), 'Supprimé')} style={{ ...ctrlBtn, color: '#b00020' }}><Trash2 size={12} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-3)', color: 'var(--brand-duck)', background: 'transparent', cursor: 'pointer',
            }}
          >
            <ImagePlus size={16} /> {uploading ? 'Envoi…' : 'Ajouter des photos'}
          </button>
        </div>
      )}
    </div>
  );
}
