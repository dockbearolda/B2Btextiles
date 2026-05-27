'use client';
import { useState, useRef, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useEditMode } from './edit-mode-provider';
import { deleteProductImage, setPrimaryImage, moveProductImage, setImageFraming } from '@/lib/actions/product-image';
import { toast } from 'sonner';
import { Star, Trash2, ChevronLeft, ChevronRight, ImagePlus, ZoomIn } from 'lucide-react';

type Img = {
  id: string; url: string; thumbUrl: string; width: number; height: number; position: number;
  offsetX: number; offsetY: number; scale: number;
};
type Frame = { offsetX: number; offsetY: number; scale: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const ctrlBtn: React.CSSProperties = {
  display: 'grid', placeItems: 'center', width: 22, height: 22, padding: 0,
  border: '1px solid var(--brand-sage)', borderRadius: 'var(--r-1)', background: '#fff', cursor: 'pointer',
};

export function imageFrameStyle(fr: Frame): React.CSSProperties {
  return {
    width: '100%', height: '100%', objectFit: 'contain',
    transform: `translate(${fr.offsetX}%, ${fr.offsetY}%) scale(${fr.scale})`,
    transformOrigin: 'center',
  };
}

export function ProductGallery({ productId, images }: { productId: string; images: Img[] }) {
  const { editing } = useEditMode();
  const router = useRouter();
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  // Live framing state per image id (so drag/zoom is instant), seeded from props.
  const [frames, setFrames] = useState<Record<string, Frame>>({});
  useEffect(() => {
    setFrames(Object.fromEntries(images.map((i) => [i.id, { offsetX: i.offsetX, offsetY: i.offsetY, scale: i.scale }])));
  }, [images]);

  const main = images[active] ?? images[0];
  const f: Frame = (main && frames[main.id]) || { offsetX: 0, offsetY: 0, scale: 1 };

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback((id: string, fr: Frame) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setImageFraming(id, fr).catch(() => toast.error('Échec de l’enregistrement du cadrage'));
    }, 500);
  }, []);

  const updateFrame = useCallback((id: string, patch: Partial<Frame>) => {
    setFrames((prev) => {
      const next = { ...(prev[id] ?? { offsetX: 0, offsetY: 0, scale: 1 }), ...patch };
      scheduleSave(id, next);
      return { ...prev, [id]: next };
    });
  }, [scheduleSave]);

  // Drag to pan (edit mode only).
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if (!editing || !main) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: f.offsetX, oy: f.offsetY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current || !main) return;
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = ((e.clientX - drag.current.x) / rect.width) * 100;
    const dy = ((e.clientY - drag.current.y) / rect.height) * 100;
    updateFrame(main.id, { offsetX: clamp(drag.current.ox + dx, -100, 100), offsetY: clamp(drag.current.oy + dy, -100, 100) });
  }
  function onPointerUp() { drag.current = null; }

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fd = new FormData();
    Array.from(files).forEach((file) => fd.append('files', file));
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

  const frameStyle: React.CSSProperties = {
    aspectRatio: '4 / 3', borderRadius: 'var(--r-5)', background: 'var(--brand-linen)',
    overflow: 'hidden', display: 'grid', placeItems: 'center',
    touchAction: editing && main ? 'none' : undefined,
    cursor: editing && main ? 'move' : 'default',
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div ref={frameRef} style={frameStyle}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {main ? (
          <img src={main.url} alt="" draggable={false}
            style={{ ...imageFrameStyle(f), userSelect: 'none', pointerEvents: 'none' }} />
        ) : (
          <span className="micro-label">Aucune photo</span>
        )}
      </div>

      {editing && main && (
        <div style={{ display: 'grid', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ZoomIn size={15} />
            <input type="range" min={1} max={4} step={0.02} value={f.scale} aria-label="Zoom de la photo"
              onChange={(e) => updateFrame(main.id, { scale: Number(e.target.value) })} style={{ flex: 1 }} />
            <button onClick={() => updateFrame(main.id, { offsetX: 0, offsetY: 0, scale: 1 })}
              style={{ ...ctrlBtn, width: 'auto', padding: '0 8px', fontSize: 12 }}>Réinit.</button>
          </div>
          <p className="micro-label" style={{ margin: 0 }}>Glisse la photo pour la recentrer, le curseur pour zoomer.</p>
        </div>
      )}

      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((img, i) => (
            <div key={img.id} style={{ display: 'grid', gap: 2 }}>
              <button onClick={() => setActive(i)} aria-label={`Photo ${i + 1}`}
                style={{
                  border: i === active ? '2px solid var(--brand-duck)' : '1px solid var(--brand-sage)',
                  borderRadius: 'var(--r-2)', padding: 0, width: 64, height: 48, overflow: 'hidden', background: 'none', cursor: 'pointer',
                }}>
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
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-3)', color: 'var(--brand-duck)', background: 'transparent', cursor: 'pointer',
            }}>
            <ImagePlus size={16} /> {uploading ? 'Envoi…' : 'Ajouter des photos'}
          </button>
        </div>
      )}
    </div>
  );
}
