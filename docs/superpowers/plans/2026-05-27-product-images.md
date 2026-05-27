# Product Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin d'ajouter/gérer des photos sur les produits (upload, galerie, suppression, principale, réordre), affichées sur les cartes et la fiche, stockées sur un volume persistant via un adaptateur swappable.

**Architecture:** Un adaptateur de stockage (`local` sur volume Railway) derrière une interface ; un route handler d'upload (multipart) qui traite l'image avec `sharp` (full + thumb WebP) ; un route handler de service ; des server actions pour delete/reorder/principale ; un composant galerie client. Le modèle `ProductImage` existe déjà (aucune migration).

**Tech Stack:** Next 16 (App Router, route handlers + server actions), Prisma 6, `sharp`, vitest (logique pure).

> **Référence :** lire `docs/superpowers/specs/2026-05-27-product-images-design.md`. Rappel projet (AGENTS.md) : « This is NOT the Next.js you know » — lire `node_modules/next/dist/docs/` au besoin (route handlers, streaming `Response`).

---

## File Structure

- Create `lib/images/keys.ts` (+ `lib/images/keys.test.ts`) — génération de clé + dérivation thumb + URL publique (pur, testé).
- Create `lib/images/process.ts` (+ `lib/images/process.test.ts`) — traitement `sharp` (full+thumb WebP, dims).
- Create `lib/storage/index.ts` — interface `Storage` + sélection par `STORAGE`.
- Create `lib/storage/local.ts` (+ `lib/storage/local.test.ts`) — impl. disque sous `UPLOAD_DIR`, résolution de chemin sûre.
- Create `app/api/products/[id]/images/route.ts` — POST upload.
- Create `app/uploads/[...path]/route.ts` — GET service de fichier.
- Create `lib/actions/product-image.ts` — `deleteProductImage`, `moveProductImage`, `setPrimaryImage`.
- Create `components/product-gallery.tsx` — galerie + UI d'upload (mode édition).
- Modify `components/product-card.tsx` — afficher la vignette principale.
- Modify `app/catalogue/[genreSlug]/[productSlug]/page.tsx` — charger les images + monter la galerie.
- Modify `app/catalogue/page.tsx`, `app/catalogue/[genreSlug]/page.tsx` — inclure l'image principale dans les données de carte.
- Modify `package.json` — déclarer `sharp` ; `.gitignore` — ignorer `/.data`.

---

## Task 1: Utilitaires de clés/URL d'image (TDD) + dépendance sharp

**Files:** Create `lib/images/keys.ts`, `lib/images/keys.test.ts`; Modify `package.json`, `.gitignore`

- [ ] **Step 1: Déclarer sharp + ignorer le dossier d'uploads local**

```bash
cd "/Users/charlie/Desktop/Textile B2B"
npm i sharp
printf '\n# local image uploads (dev; prod uses a Railway volume)\n/.data\n' >> .gitignore
```
Expected: `sharp` listé dans `dependencies`.

- [ ] **Step 2: Test qui échoue**

Create `lib/images/keys.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { newImageKey, thumbKey, publicUrl, thumbUrlFromUrl } from './keys';

describe('image keys', () => {
  it('génère une clé .webp unique', () => {
    const k = newImageKey();
    expect(k).toMatch(/^[a-z0-9]+\.webp$/);
    expect(newImageKey()).not.toBe(k);
  });
  it('dérive la clé thumb', () => {
    expect(thumbKey('abc.webp')).toBe('abc.thumb.webp');
  });
  it('construit l’URL publique', () => {
    expect(publicUrl('abc.webp')).toBe('/uploads/abc.webp');
  });
  it('dérive l’URL thumb depuis l’URL full', () => {
    expect(thumbUrlFromUrl('/uploads/abc.webp')).toBe('/uploads/abc.thumb.webp');
  });
});
```

- [ ] **Step 3: Lancer, vérifier l'échec**

Run: `npx vitest run lib/images/keys.test.ts` → FAIL (module introuvable).

- [ ] **Step 4: Implémenter**

Create `lib/images/keys.ts`:
```ts
import { randomBytes } from 'crypto';

export function newImageKey(): string {
  return `${Date.now().toString(36)}${randomBytes(6).toString('hex')}.webp`;
}
export function thumbKey(key: string): string {
  return key.replace(/\.webp$/, '.thumb.webp');
}
export function publicUrl(key: string): string {
  return `/uploads/${key}`;
}
export function thumbUrlFromUrl(url: string): string {
  return url.replace(/\.webp$/, '.thumb.webp');
}
```

- [ ] **Step 5: Lancer, vérifier le succès**

Run: `npx vitest run lib/images/keys.test.ts` → PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore lib/images/keys.ts lib/images/keys.test.ts
git commit -m "feat(images): image key/url helpers + sharp dep"
```

---

## Task 2: Traitement d'image sharp (TDD léger)

**Files:** Create `lib/images/process.ts`, `lib/images/process.test.ts`

- [ ] **Step 1: Test qui échoue** (génère une vraie image en mémoire avec sharp)

Create `lib/images/process.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processImage } from './process';

async function redPng(w: number, h: number) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 0, b: 0 } } }).png().toBuffer();
}

describe('processImage', () => {
  it('produit full+thumb WebP avec dimensions plafonnées', async () => {
    const input = await redPng(2400, 1800);
    const out = await processImage(input);
    expect((await sharp(out.full).metadata()).format).toBe('webp');
    expect((await sharp(out.thumb).metadata()).format).toBe('webp');
    expect(out.width).toBeLessThanOrEqual(1600);
    expect((await sharp(out.thumb).metadata()).width!).toBeLessThanOrEqual(500);
  });
  it('rejette un buffer non-image', async () => {
    await expect(processImage(Buffer.from('pas une image'))).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run lib/images/process.test.ts` → FAIL.

- [ ] **Step 3: Implémenter**

Create `lib/images/process.ts`:
```ts
import sharp from 'sharp';

const FULL_MAX = 1600;
const THUMB_MAX = 500;

export type ProcessedImage = { full: Buffer; thumb: Buffer; width: number; height: number };

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const meta = await sharp(input).metadata(); // throws si non-image
  if (!meta.width || !meta.height) throw new Error('Image invalide');

  const base = sharp(input).rotate(); // respecte l'orientation EXIF puis strip metadata
  const full = await base.clone().resize({ width: FULL_MAX, height: FULL_MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  const thumb = await base.clone().resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
  const fullMeta = await sharp(full).metadata();
  return { full, thumb, width: fullMeta.width!, height: fullMeta.height! };
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run lib/images/process.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/images/process.ts lib/images/process.test.ts
git commit -m "feat(images): sharp processing (full+thumb webp)"
```

---

## Task 3: Adaptateur de stockage local (résolution de chemin sûre, TDD)

**Files:** Create `lib/storage/index.ts`, `lib/storage/local.ts`, `lib/storage/local.test.ts`

- [ ] **Step 1: Test qui échoue** (round-trip dans un dossier temporaire + anti-traversal)

Create `lib/storage/local.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalStorage } from './local';

let dir: string;
beforeAll(() => { dir = mkdtempSync(join(tmpdir(), 'tb2b-')); });
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

describe('LocalStorage', () => {
  it('écrit, lit puis supprime un fichier', async () => {
    const s = new LocalStorage(dir);
    await s.save('a.webp', Buffer.from('hello'));
    expect(existsSync(join(dir, 'a.webp'))).toBe(true);
    expect((await s.read('a.webp')).buffer.toString()).toBe('hello');
    await s.delete('a.webp');
    expect(existsSync(join(dir, 'a.webp'))).toBe(false);
  });
  it('refuse une traversée de chemin', async () => {
    const s = new LocalStorage(dir);
    await expect(s.read('../secret')).rejects.toThrow();
  });
  it('tolère la suppression d’un fichier absent', async () => {
    const s = new LocalStorage(dir);
    await expect(s.delete('absent.webp')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run lib/storage/local.test.ts` → FAIL.

- [ ] **Step 3: Implémenter l'interface + l'impl locale**

Create `lib/storage/index.ts`:
```ts
import { LocalStorage } from './local';

export interface Storage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<{ buffer: Buffer; contentType: string }>;
  delete(key: string): Promise<void>;
}

let instance: Storage | null = null;
export function getStorage(): Storage {
  if (instance) return instance;
  const backend = process.env.STORAGE ?? 'local';
  if (backend === 'local') {
    instance = new LocalStorage(process.env.UPLOAD_DIR ?? '.data/uploads');
    return instance;
  }
  throw new Error(`STORAGE inconnu : ${backend}`);
}
```

Create `lib/storage/local.ts`:
```ts
import { mkdir, readFile, writeFile, unlink } from 'fs/promises';
import { join, resolve, extname } from 'path';
import type { Storage } from './index';

const CT: Record<string, string> = { '.webp': 'image/webp' };

export class LocalStorage implements Storage {
  constructor(private root: string) {}

  private resolveSafe(key: string): string {
    const root = resolve(this.root);
    const p = resolve(root, key);
    if (p !== root && !p.startsWith(root + '/')) throw new Error('Chemin invalide');
    return p;
  }
  async save(key: string, data: Buffer): Promise<void> {
    const p = this.resolveSafe(key);
    await mkdir(resolve(this.root), { recursive: true });
    await writeFile(p, data);
  }
  async read(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    const p = this.resolveSafe(key);
    const buffer = await readFile(p);
    return { buffer, contentType: CT[extname(p)] ?? 'application/octet-stream' };
  }
  async delete(key: string): Promise<void> {
    const p = this.resolveSafe(key);
    await unlink(p).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; });
  }
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run lib/storage/local.test.ts` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/storage/index.ts lib/storage/local.ts lib/storage/local.test.ts
git commit -m "feat(images): swappable storage adapter (local impl)"
```

---

## Task 4: Route handler d'upload

**Files:** Create `app/api/products/[id]/images/route.ts` (vérifié en navigateur/prod)

- [ ] **Step 1: Implémenter la route POST**

Create `app/api/products/[id]/images/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getIsAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { processImage } from '@/lib/images/process';
import { newImageKey, thumbKey, publicUrl } from '@/lib/images/keys';
import { getStorage } from '@/lib/storage';
import { revalidatePath } from 'next/cache';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getIsAdmin())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 });

  const storage = getStorage();
  const agg = await prisma.productImage.aggregate({ where: { productId: id }, _max: { position: true } });
  let position = (agg._max.position ?? -1) + 1;
  let created = 0;

  for (const file of files) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: `Fichier trop volumineux (max 8 Mo) : ${file.name}` }, { status: 413 });
    let processed;
    try { processed = await processImage(Buffer.from(await file.arrayBuffer())); }
    catch { return NextResponse.json({ error: `Fichier non valide : ${file.name}` }, { status: 415 }); }
    const key = newImageKey();
    await storage.save(key, processed.full);
    await storage.save(thumbKey(key), processed.thumb);
    await prisma.productImage.create({
      data: { productId: id, url: publicUrl(key), width: processed.width, height: processed.height, position: position++ },
    });
    created++;
  }
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, created });
}
```

- [ ] **Step 2: Vérif build de type**

Run: `npx tsc --noEmit` → aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add app/api/products/[id]/images/route.ts
git commit -m "feat(images): upload route (multipart, sharp, persist)"
```

---

## Task 5: Route handler de service des fichiers

**Files:** Create `app/uploads/[...path]/route.ts`

- [ ] **Step 1: Implémenter la route GET**

Create `app/uploads/[...path]/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  try {
    const { buffer, contentType } = await getStorage().read(path.join('/'));
    return new NextResponse(new Uint8Array(buffer), {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
```

- [ ] **Step 2: Vérif build de type**

Run: `npx tsc --noEmit` → OK.

- [ ] **Step 3: Commit**

```bash
git add app/uploads/[...path]/route.ts
git commit -m "feat(images): static-file serving route from storage"
```

---

## Task 6: Server actions image (suppression, réordre, principale)

**Files:** Create `lib/actions/product-image.ts`

- [ ] **Step 1: Implémenter les actions**

Create `lib/actions/product-image.ts`:
```ts
'use server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { getStorage } from '@/lib/storage';
import { thumbKey } from '@/lib/images/keys';
import { revalidatePath } from 'next/cache';

function keyFromUrl(url: string): string { return url.replace(/^\/uploads\//, ''); }

export async function deleteProductImage(id: string) {
  await requireAdmin();
  const img = await prisma.productImage.findUnique({ where: { id } });
  if (!img) return { ok: true };
  const storage = getStorage();
  const key = keyFromUrl(img.url);
  await storage.delete(key);
  await storage.delete(thumbKey(key));
  await prisma.productImage.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setPrimaryImage(id: string) {
  await requireAdmin();
  const img = await prisma.productImage.findUnique({ where: { id } });
  if (!img) throw new Error('Image introuvable');
  const others = await prisma.productImage.findMany({
    where: { productId: img.productId, id: { not: id } }, orderBy: { position: 'asc' },
  });
  await prisma.$transaction([
    prisma.productImage.update({ where: { id }, data: { position: 0 } }),
    ...others.map((o, i) => prisma.productImage.update({ where: { id: o.id }, data: { position: i + 1 } })),
  ]);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function moveProductImage(id: string, dir: 'up' | 'down') {
  await requireAdmin();
  const img = await prisma.productImage.findUnique({ where: { id } });
  if (!img) throw new Error('Image introuvable');
  const neighbor = await prisma.productImage.findFirst({
    where: {
      productId: img.productId,
      position: dir === 'up' ? { lt: img.position } : { gt: img.position },
    },
    orderBy: { position: dir === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbor) return { ok: true };
  await prisma.$transaction([
    prisma.productImage.update({ where: { id: img.id }, data: { position: neighbor.position } }),
    prisma.productImage.update({ where: { id: neighbor.id }, data: { position: img.position } }),
  ]);
  revalidatePath('/', 'layout');
  return { ok: true };
}
```

- [ ] **Step 2: Build de type + commit**

Run: `npx tsc --noEmit` → OK.
```bash
git add lib/actions/product-image.ts
git commit -m "feat(images): delete/reorder/set-primary server actions"
```

---

## Task 7: Composant galerie + UI d'upload

**Files:** Create `components/product-gallery.tsx`

- [ ] **Step 1: Implémenter la galerie (client)**

Create `components/product-gallery.tsx`:
```tsx
'use client';
import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useEditMode } from './edit-mode-provider';
import { deleteProductImage, setPrimaryImage, moveProductImage } from '@/lib/actions/product-image';
import { thumbUrlFromUrl } from '@/lib/images/keys';
import { toast } from 'sonner';
import { Star, Trash2, ChevronLeft, ChevronRight, ImagePlus } from 'lucide-react';

type Img = { id: string; url: string; width: number; height: number; position: number };

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
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Échec de l’upload'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  }
  function act(fn: () => Promise<unknown>, okMsg?: string) {
    start(async () => { try { await fn(); if (okMsg) toast.success(okMsg); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : 'Échec'); } });
  }

  const frame: React.CSSProperties = { aspectRatio: '4 / 3', borderRadius: 'var(--r-5)', background: 'var(--brand-linen)', overflow: 'hidden', display: 'grid', placeItems: 'center' };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={frame}>
        {main
          ? <img src={main.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span className="micro-label">Aucune photo</span>}
      </div>

      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((img, i) => (
            <div key={img.id} style={{ position: 'relative' }}>
              <button onClick={() => setActive(i)} style={{ border: i === active ? '2px solid var(--brand-duck)' : '1px solid var(--brand-sage)', borderRadius: 'var(--r-2)', padding: 0, width: 64, height: 48, overflow: 'hidden', background: 'none' }}>
                <img src={thumbUrlFromUrl(img.url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
              {editing && (
                <div style={{ display: 'flex', gap: 2, marginTop: 2 }}>
                  <button title="Monter" disabled={pending} onClick={() => act(() => moveProductImage(img.id, 'up'))}><ChevronLeft size={13} /></button>
                  <button title="Principale" disabled={pending} onClick={() => act(() => setPrimaryImage(img.id), 'Principale définie')}><Star size={13} /></button>
                  <button title="Descendre" disabled={pending} onClick={() => act(() => moveProductImage(img.id, 'down'))}><ChevronRight size={13} /></button>
                  <button title="Supprimer" disabled={pending} onClick={() => act(() => deleteProductImage(img.id), 'Supprimé')} style={{ color: '#b00020' }}><Trash2 size={13} /></button>
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
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-3)', color: 'var(--brand-duck)', background: 'transparent' }}>
            <ImagePlus size={16} /> {uploading ? 'Envoi…' : 'Ajouter des photos'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build de type + commit**

Run: `npx tsc --noEmit` → OK.
```bash
git add components/product-gallery.tsx
git commit -m "feat(images): product gallery with upload/manage UI"
```

---

## Task 8: Câbler l'affichage (fiche + cartes)

**Files:** Modify `app/catalogue/[genreSlug]/[productSlug]/page.tsx`, `components/product-card.tsx`, `app/catalogue/page.tsx`, `app/catalogue/[genreSlug]/page.tsx`

- [ ] **Step 1: Fiche — charger les images + monter la galerie**

Dans `app/catalogue/[genreSlug]/[productSlug]/page.tsx` :
- Ajouter `images: { orderBy: { position: 'asc' } }` à la requête `prisma.product.findUnique`.
- Importer `ProductGallery` et **remplacer** le placeholder `<div style={{ aspectRatio: '4 / 3', borderRadius: 'var(--r-5)', background: 'var(--brand-linen)' }} />` par :
```tsx
<ProductGallery productId={product.id} images={product.images.map((i) => ({ id: i.id, url: i.url, width: i.width, height: i.height, position: i.position }))} />
```

- [ ] **Step 2: Carte — afficher la vignette principale**

Dans `components/product-card.tsx` :
- Étendre `CardProduct` avec `imageUrl: string | null` (vignette de l'image principale).
- Remplacer le placeholder `<div style={{ aspectRatio: '4 / 3', ... 'var(--brand-linen)', marginBottom: 10 }} />` par :
```tsx
<div style={{ aspectRatio: '4 / 3', borderRadius: 'var(--r-3)', background: 'var(--brand-linen)', marginBottom: 10, overflow: 'hidden' }}>
  {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
</div>
```

- [ ] **Step 3: Requêtes de cartes — inclure l'image principale**

Dans `app/catalogue/page.tsx` et `app/catalogue/[genreSlug]/page.tsx` :
- Ajouter à la requête produits : `include: { genre: { select: { slug: true } }, images: { orderBy: { position: 'asc' }, take: 1 } }` (adapter si `include` existe déjà ; sur la page genre, ajouter `images: { orderBy: { position: 'asc' }, take: 1 }`).
- Importer `thumbUrlFromUrl` depuis `@/lib/images/keys`.
- Passer `imageUrl: p.images[0] ? thumbUrlFromUrl(p.images[0].url) : null` dans l'objet `ProductCard`.

- [ ] **Step 4: Build de type**

Run: `npx tsc --noEmit` → OK.

- [ ] **Step 5: Commit**

```bash
git add app/catalogue components/product-card.tsx
git commit -m "feat(images): show primary thumb on cards + gallery on detail"
```

---

## Task 9: Infra Railway (volume) + vérif build local

**Files:** (config Railway — ressource externe ; vérif locale)

- [ ] **Step 1: Vérifier le build de prod en local**

Run: `npm run build` → succès (`prisma generate` + `next build`). Run: `npm test` → tous verts (incl. nouveaux tests images).

- [ ] **Step 2: Provisionner le volume + variable (ressource externe — annoncer)**

Via le skill `use-railway` : créer un **volume** sur le service `web` monté sur `/data`, et définir `UPLOAD_DIR=/data/uploads`. (Le code crée le dossier au 1er upload.) Redéployer.

- [ ] **Step 3: Commit éventuel** (aucun fichier de code ici ; le volume est de la config Railway.)

---

## Task 10: Vérification (navigateur local + prod)

- [ ] **Step 1: Local** — `npm run dev`, connecté en mode édition, ouvrir une fiche produit : « Ajouter des photos » → choisir une image → la galerie l'affiche, la carte du catalogue montre la vignette. Tester supprimer / principale / réordonner. Recharger → persistance. Voir `feedback_browser-testing` (utiliser `preview_fill`/`requestSubmit`/`blur` via `preview_eval`, vérifier la BDD au besoin).
- [ ] **Step 2: Prod** — après déploiement : se connecter (loic), ajouter une photo sur un produit, vérifier l'affichage + la persistance après reload. Confirmer que les fichiers survivent à un redéploiement (volume).

---

## Self-Review (effectué)

- **Couverture spec :** adaptateur stockage (T3) ✓, upload+sharp (T2,T4) ✓, service fichiers (T5) ✓, galerie+upload UI (T7) ✓, affichage carte/fiche (T8) ✓, actions delete/reorder/principale (T6) ✓, volume Railway (T9) ✓, vignette+full (T1,T2) ✓. Hors-périmètre (mockups, couleurs, R2) non inclus — conforme.
- **Placeholders :** aucun ; code complet par étape. Les tâches fs/route/UI sont vérifiées navigateur/prod (workflow projet), tests unitaires sur la logique pure (keys, process, storage).
- **Cohérence des types :** `Storage` (save/read/delete) identique partout ; `publicUrl`/`thumbKey`/`thumbUrlFromUrl` cohérents entre upload, service, galerie ; `ProductImage` (url/width/height/position) inchangé (pas de migration).
- **Ambiguïté :** `UPLOAD_DIR` défaut `.data/uploads` (dev) / `/data/uploads` (prod, volume) ; principale = position 0 ; formats → WebP ; max 8 Mo/fichier.
