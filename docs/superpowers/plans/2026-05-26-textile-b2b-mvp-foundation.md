# Textile B2B — Plan 1 : MVP Fondations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une app catalogue Next.js déployée où l'admin se connecte, définit le nom de la maison, crée des familles (genres) et des produits (désignation, description, prix, refs) en édition inline, et navigue le tout comme un client.

**Architecture:** Next.js 16 App Router, une seule arborescence de pages (« admin = copie du site »). Les mutations passent par des Server Actions : une action générique `updateField` (validée par un registre zod + allowlist de champs) pour l'édition inline, et des actions typées dédiées pour créer/supprimer. L'état « connecté » est lu côté serveur dans le layout et propagé via un contexte client `EditMode`.

**Tech Stack:** Next.js 16, TypeScript strict, Tailwind v4, Prisma 6 + Postgres, Auth.js (NextAuth v5) Credentials + `@node-rs/argon2`, zod, sonner, lucide-react. Tests : vitest sur les unités logiques pures (slug, validation de champ, rate-limit). Le reste est vérifié via `npm run dev` + navigateur puis `npm run build`, conformément au workflow « je teste en preview » du projet.

**Périmètre Plan 1 :** scaffold → schéma + auth → coquille (top-nav + sidebar + état vide) → CRUD inline Genre → CRUD Produit (champs texte/prix/refs) → config + déploiement Railway. **Hors périmètre (Plan 2) :** couleurs textile, tailles/stock, upload images/mockups, logos, recherche/filtres, brouillon-publié UI, dupliquer, CSV.

---

## File Structure

Fichiers créés dans ce plan (chemins exacts, racine = dossier projet) :

- `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs` — générés par create-next-app (Task 1).
- `app/globals.css` — `@import "tailwindcss"` + tokens design (Task 1).
- `app/layout.tsx` — layout racine : providers, Toaster, AdminBar, lecture session (Task 3).
- `app/page.tsx` — redirige `/` → `/catalogue` (Task 1).
- `app/catalogue/layout.tsx` — coquille : top-nav + sidebar + main (Task 5/6).
- `app/catalogue/page.tsx` — grille de tous les produits (Task 7).
- `app/catalogue/[genreSlug]/page.tsx` — grille filtrée par genre (Task 6/7).
- `app/catalogue/[genreSlug]/[productSlug]/page.tsx` — fiche détail (Task 7).
- `app/login/page.tsx`, `app/login/actions.ts` — connexion (Task 3).
- `app/api/auth/[...nextauth]/route.ts` — handlers Auth.js (Task 3).
- `auth.ts` — config NextAuth v5 (Task 3).
- `types/next-auth.d.ts` — augmentation `role` (Task 3).
- `lib/db.ts` — singleton PrismaClient (Task 2).
- `lib/slug.ts` (+ `lib/slug.test.ts`) — slugify (Task 1).
- `lib/rate-limit.ts` (+ `lib/rate-limit.test.ts`) — limiteur mémoire (Task 3).
- `lib/auth-guard.ts` — `requireAdmin`, `getIsAdmin` (Task 3).
- `lib/mutations/field-schemas.ts` (+ `lib/mutations/field-schemas.test.ts`) — schémas zod + `validateFieldUpdate` (Task 4).
- `lib/mutations/models.ts` — entité → délégué Prisma + résolution id (Task 4).
- `lib/actions/update-field.ts` — Server Action générique (Task 4).
- `lib/actions/genre.ts` — `createGenre`, `deleteGenre` (Task 6).
- `lib/actions/product.ts` — `createProduct`, `deleteProduct` (Task 7).
- `lib/actions/session.ts` — `signOutAction` (Task 3).
- `components/edit-mode-provider.tsx` — contexte client + sync body (Task 3).
- `components/admin-bar.tsx` — barre flottante (Task 3).
- `components/editable-text.tsx` — `<EditableText>` / `<EditableNumber>` (Task 4).
- `components/editable-select.tsx` — `<EditableSelect>` (Task 7).
- `components/new-entity-card.tsx` — carte fantôme « + Nouveau… » (Task 6).
- `components/top-nav.tsx` — barre du haut + marque éditable (Task 5).
- `components/sidebar.tsx` — liste genres + état vide (Task 6).
- `components/product-card.tsx` — carte produit (Task 7).
- `components/empty-state.tsx` — état vide catalogue (Task 6).
- `prisma/schema.prisma`, `prisma/seed.ts` — modèle + seed idempotent (Task 2).
- `railway.json`, `start.sh`, `.env.example` — déploiement (Task 8).

---

## Task 1: Scaffold + tokens + redirect + slugify (TDD)

**Files:**
- Create (générés): tout le squelette Next.js
- Modify: `app/globals.css`, `app/page.tsx`, `package.json`
- Create: `lib/slug.ts`, `lib/slug.test.ts`, `vitest.config.ts`

- [ ] **Step 1: Scaffolder dans un dossier temporaire puis rapatrier (sans casser `.git`/`docs`)**

create-next-app refuse un dossier non vide. On scaffolde dans `.scaffold` puis on déplace, en **excluant tout `.git`** et **sans toucher** à `docs/`. `--disable-git` empêche un init git parasite ; `--skip-install` évite de déplacer un gros `node_modules` (les deps sont installées à l'étape 2).

Run:
```bash
npx create-next-app@latest .scaffold --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --skip-install --disable-git --yes
shopt -s dotglob
for item in .scaffold/*; do
  base=$(basename "$item")
  [ "$base" = ".git" ] && continue          # ne jamais écraser notre repo
  rm -rf "./$base" 2>/dev/null || true       # remplace un éventuel fichier de même nom (ex. .gitignore)
  mv "$item" .
done
shopt -u dotglob
rm -rf .scaffold
printf '\n# local image storage (STORAGE=local)\n/public/uploads\n' >> .gitignore
```
> La boucle n'itère que sur le contenu de `.scaffold` (package.json, app/, .gitignore, tsconfig.json, etc.) : `docs/` et `.git/` à la racine ne sont jamais touchés.
Expected: `app/`, `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs` présents à la racine ; `docs/` et `.git/` intacts ; aucun dossier `.scaffold` résiduel.

- [ ] **Step 2: Installer les dépendances du projet**

Run:
```bash
npm i @prisma/client@^6 next-auth@beta @node-rs/argon2 zod sonner lucide-react
npm i -D prisma@^6 vitest
```
Expected: installation OK, `package.json` liste ces dépendances.

- [ ] **Step 3: Activer TypeScript strict**

Vérifier que `tsconfig.json` contient `"strict": true` dans `compilerOptions` (create-next-app le met par défaut). Si absent, l'ajouter.

- [ ] **Step 4: Écrire le test qui échoue pour `slugify`**

Create `lib/slug.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it('met en minuscules et remplace les espaces', () => {
    expect(slugify('T-Shirt Premium')).toBe('t-shirt-premium');
  });
  it('retire les accents', () => {
    expect(slugify('Étiquette tissée')).toBe('etiquette-tissee');
  });
  it('réduit les séparateurs multiples et coupe les bords', () => {
    expect(slugify('  Polo --- 100% coton !! ')).toBe('polo-100-coton');
  });
  it('renvoie une base par défaut si vide', () => {
    expect(slugify('!!!')).toBe('item');
  });
});
```

- [ ] **Step 5: Lancer le test, vérifier l'échec**

Add to `package.json` scripts: `"test": "vitest run"`.
Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['**/*.test.ts'] } });
```
Run: `npx vitest run lib/slug.test.ts`
Expected: FAIL — `slugify` introuvable.

- [ ] **Step 6: Implémenter `slugify`**

Create `lib/slug.ts`:
```ts
export function slugify(input: string): string {
  const s = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'item';
}
```

- [ ] **Step 7: Lancer le test, vérifier le succès**

Run: `npx vitest run lib/slug.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Poser les tokens design dans `app/globals.css`**

Replace `app/globals.css` content with:
```css
@import "tailwindcss";

:root {
  --brand-duck: #4A6274;
  --brand-duck-300: #6B8191;
  --brand-sage: #CDD4CD;
  --brand-linen: #EBEAE8;
  --brand-paper: #f4f4f2;
  --fg-1: #202930;
  --fg-2: #2f3b45;
  --fg-3: #556876;
  --fg-4: #8BA0AF;
  --r-1: 6px; --r-2: 8px; --r-3: 10px; --r-4: 12px; --r-5: 16px; --r-6: 20px;
  --shadow-1: 0 1px 2px rgba(74,98,116,0.04);
  --ease-snap: cubic-bezier(0.32, 0.72, 0, 1);
  --bg: var(--brand-linen);
}

html, body {
  background: var(--bg);
  color: var(--fg-2);
  font-family: -apple-system, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  font-variant-numeric: tabular-nums;
}

/* Mode édition : fond légèrement plus chaud */
body[data-edit-mode="on"] { --bg: #f6f3ec; }

.micro-label {
  font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-4);
}
```

- [ ] **Step 9: Rediriger `/` vers `/catalogue`**

Replace `app/page.tsx` with:
```tsx
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/catalogue');
}
```

- [ ] **Step 10: Vérifier le démarrage**

Run: `npm run dev` (puis arrêter avec Ctrl-C après vérif).
Expected: serveur sur http://localhost:3000 ; ouvrir `/` redirige vers `/catalogue` (404 attendu pour l'instant, la page n'existe pas encore — normal).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 16 + Tailwind v4 tokens + slugify util"
```

---

## Task 2: Schéma Prisma + client + seed admin idempotent

**Files:**
- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `lib/db.ts`
- Modify: `package.json` (scripts prisma), `.env`

- [ ] **Step 1: Initialiser Prisma**

Run: `npx prisma init --datasource-provider postgresql`
Expected: crée `prisma/schema.prisma` et ajoute `DATABASE_URL` dans `.env`.

- [ ] **Step 2: Écrire le schéma complet** (tous les modèles dès maintenant pour éviter les migrations à répétition)

Replace `prisma/schema.prisma` with:
```prisma
generator client {
  provider = "prisma-client-js"
}
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model SiteSettings {
  id         Int      @id @default(1)
  brandName  String   @default("")
  monogram   String   @default("")
  quoteEmail String   @default("")
  updatedAt  DateTime @updatedAt
}

model Genre {
  id          String    @id @default(cuid())
  slug        String    @unique
  name        String
  description String?
  position    Int       @default(0)
  products    Product[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model FabricColor {
  id       String    @id @default(cuid())
  name     String
  hex      String
  position Int       @default(0)
  products Product[]
}

model Size {
  id       String        @id @default(cuid())
  label    String        @unique
  position Int           @default(0)
  products ProductSize[]
}

model Product {
  id             String   @id @default(cuid())
  slug           String   @unique
  designation    String
  description    String?  @db.Text
  refInterne     String?  @unique
  refFournisseur String?
  prix           Decimal  @db.Decimal(8, 2)
  published      Boolean  @default(true)
  deletedAt      DateTime?

  genreId        String
  genre          Genre        @relation(fields: [genreId], references: [id])
  fabricColorId  String?
  fabricColor    FabricColor? @relation(fields: [fabricColorId], references: [id])
  logoId         String?
  logo           Logo?        @relation(fields: [logoId], references: [id])

  sizes          ProductSize[]
  images         ProductImage[]

  position       Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model ProductSize {
  productId String
  sizeId    String
  stock     Int     @default(0)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  size      Size    @relation(fields: [sizeId], references: [id])
  @@id([productId, sizeId])
}

model ProductImage {
  id        String  @id @default(cuid())
  productId String
  url       String
  width     Int
  height    Int
  position  Int     @default(0)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model Logo {
  id        String    @id @default(cuid())
  name      String
  kind      LogoKind
  url       String
  monoColor String?
  colors    String[]
  position  Int       @default(0)
  products  Product[]
}

enum LogoKind { MONO MULTI }
```
> Note : `published` par défaut `true` (l'admin construit le vrai catalogue ; la distinction brouillon/publié arrive en Plan 2).

- [ ] **Step 3: Renseigner `DATABASE_URL` pour le dev local**

Éditer `.env` avec une base Postgres locale, p.ex. :
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/textileb2b?schema=public"
```
> Si pas de Postgres local : `createdb textileb2b` (ou via Docker `docker run --name tb2b-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16`).

- [ ] **Step 4: Créer la migration initiale**

Run: `npx prisma migrate dev --name init`
Expected: crée `prisma/migrations/<ts>_init/` et applique le schéma ; `prisma generate` s'exécute.

- [ ] **Step 5: Singleton Prisma**

Create `lib/db.ts`:
```ts
import { PrismaClient } from '@prisma/client';
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;
```

- [ ] **Step 6: Seed idempotent (admin + SiteSettings)**

Create `prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main() {
  await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const passwordHash = await hash(password);
    await prisma.adminUser.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, passwordHash },
    });
    console.log(`Admin prêt : ${email}`);
  } else {
    console.log('ADMIN_EMAIL/ADMIN_PASSWORD non définis — seed admin ignoré.');
  }
}
main().finally(() => prisma.$disconnect());
```
Add to `package.json`:
```json
"prisma": { "seed": "node --import tsx prisma/seed.ts" },
"scripts": { "...": "...", "db:seed": "node --import tsx prisma/seed.ts", "db:migrate": "prisma migrate deploy" }
```
> tsx n'est pas installé : `npm i -D tsx`.

- [ ] **Step 7: Lancer le seed en local et vérifier l'admin**

Run:
```bash
ADMIN_EMAIL="patron@maison.fr" ADMIN_PASSWORD="motdepassetest" npm run db:seed
npx prisma studio   # vérifier table AdminUser (1 ligne) + SiteSettings (id=1), puis fermer
```
Expected: 1 AdminUser avec `passwordHash` non vide, 1 SiteSettings id=1.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: prisma schema + idempotent admin/site seed"
```

---

## Task 3: Auth.js v5 + login + requireAdmin + edit-mode + barre admin

**Files:**
- Create: `auth.ts`, `types/next-auth.d.ts`, `app/api/auth/[...nextauth]/route.ts`, `lib/auth-guard.ts`, `lib/rate-limit.ts`, `lib/rate-limit.test.ts`, `lib/actions/session.ts`, `app/login/page.tsx`, `app/login/actions.ts`, `components/edit-mode-provider.tsx`, `components/admin-bar.tsx`
- Modify: `app/layout.tsx`, `.env`

- [ ] **Step 1: Test qui échoue pour le rate-limit**

Create `lib/rate-limit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { hit } from './rate-limit';

describe('hit', () => {
  it('autorise jusqu’à la limite puis bloque', () => {
    const key = 'k1';
    expect(hit(key, 3, 1000)).toBe(true);
    expect(hit(key, 3, 1000)).toBe(true);
    expect(hit(key, 3, 1000)).toBe(true);
    expect(hit(key, 3, 1000)).toBe(false);
  });
  it('réinitialise après la fenêtre', () => {
    const key = 'k2';
    expect(hit(key, 1, 0)).toBe(true);
    expect(hit(key, 1, 0)).toBe(true); // fenêtre 0ms → déjà expirée
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run lib/rate-limit.test.ts`
Expected: FAIL — `hit` introuvable.

- [ ] **Step 3: Implémenter le rate-limit mémoire**

Create `lib/rate-limit.ts`:
```ts
type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const e = store.get(key);
  if (!e || now > e.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (e.count >= limit) return false;
  e.count += 1;
  return true;
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run lib/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 5: Augmentation de type pour le rôle**

Create `types/next-auth.d.ts`:
```ts
import type { DefaultSession } from 'next-auth';
declare module 'next-auth' {
  interface Session {
    user: { role?: 'ADMIN' | null } & DefaultSession['user'];
  }
  interface User { role?: 'ADMIN' }
}
declare module 'next-auth/jwt' {
  interface JWT { role?: 'ADMIN' | null }
}
```

- [ ] **Step 6: Config NextAuth v5**

Create `auth.ts`:
```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verify } from '@node-rs/argon2';

const credsSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (raw) => {
        const parsed = credsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.adminUser.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await verify(user.passwordHash, password);
        if (!ok) return null;
        return { id: user.id, email: user.email, role: 'ADMIN' };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = 'ADMIN';
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.role = (token.role as 'ADMIN' | null) ?? null;
      return session;
    },
  },
});
```

- [ ] **Step 7: Route handler Auth.js**

Create `app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 8: Garde admin**

Create `lib/auth-guard.ts`:
```ts
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
```

- [ ] **Step 9: Action de déconnexion**

Create `lib/actions/session.ts`:
```ts
'use server';
import { signOut } from '@/auth';
export async function signOutAction() {
  await signOut({ redirectTo: '/catalogue' });
}
```

- [ ] **Step 10: Action et page de login**

Create `app/login/actions.ts`:
```ts
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
    throw e; // laisse passer le NEXT_REDIRECT
  }
}
```
Create `app/login/page.tsx`:
```tsx
'use client';
import { useActionState } from 'react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, action, pending] = useActionState(loginAction, null);
  return (
    <main style={{ maxWidth: 360, margin: '12vh auto', padding: 24 }}>
      <h1 style={{ color: 'var(--fg-1)', marginBottom: 16 }}>Connexion</h1>
      <form action={action} style={{ display: 'grid', gap: 12 }}>
        <input name="email" type="email" placeholder="Email" required
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
```

- [ ] **Step 11: Contexte mode édition (client) + sync `<body>`**

Create `components/edit-mode-provider.tsx`:
```tsx
'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Ctx = { isAdmin: boolean; editing: boolean; setEditing: (v: boolean) => void };
const EditCtx = createContext<Ctx>({ isAdmin: false, editing: false, setEditing: () => {} });

export function EditModeProvider({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const [editing, setEditing] = useState(isAdmin);
  useEffect(() => {
    document.body.setAttribute('data-edit-mode', isAdmin && editing ? 'on' : 'off');
  }, [isAdmin, editing]);
  return <EditCtx.Provider value={{ isAdmin, editing, setEditing }}>{children}</EditCtx.Provider>;
}
export const useEditMode = () => useContext(EditCtx);
```

- [ ] **Step 12: Barre flottante admin**

Create `components/admin-bar.tsx`:
```tsx
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
```

- [ ] **Step 13: Layout racine — lit la session, monte providers + barre**

Replace `app/layout.tsx` with:
```tsx
import type { Metadata } from 'next';
import './globals.css';
import { getIsAdmin } from '@/lib/auth-guard';
import { EditModeProvider } from '@/components/edit-mode-provider';
import { AdminBar } from '@/components/admin-bar';
import { Toaster } from 'sonner';

export const metadata: Metadata = { title: 'Catalogue', description: 'Catalogue B2B' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await getIsAdmin();
  return (
    <html lang="fr">
      <body data-edit-mode={isAdmin ? 'on' : 'off'}>
        <EditModeProvider isAdmin={isAdmin}>
          {children}
          <AdminBar />
        </EditModeProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
```

- [ ] **Step 14: Générer `AUTH_SECRET` et compléter `.env`**

Run: `npx auth secret` (écrit `AUTH_SECRET` dans `.env`) — ou `echo "AUTH_SECRET=$(openssl rand -base64 32)" >> .env`.
Vérifier que `.env` contient `DATABASE_URL`, `AUTH_SECRET`, et (pour tester le login) `ADMIN_EMAIL` / `ADMIN_PASSWORD`. Re-seed si besoin : `npm run db:seed`.

- [ ] **Step 15: Vérification navigateur du login + mode édition**

Run: `npm run dev`
- Aller sur `/login`, saisir `ADMIN_EMAIL` / `ADMIN_PASSWORD` → redirection vers `/catalogue` (404 contenu OK pour l'instant) ; la barre flottante (bas-droite) apparaît ; `<body data-edit-mode="on">` (vérifier via l'inspecteur) → fond plus chaud.
- Mauvais mot de passe → message « Identifiants invalides. ».
- Bouton « Quitter » → déconnexion, la barre disparaît.
Arrêter le serveur.

- [ ] **Step 16: Commit**

```bash
git add -A
git commit -m "feat: NextAuth v5 credentials auth, login, edit-mode context + admin bar"
```

---

## Task 4: Mutation générique `updateField` + `<EditableText>` (TDD sur la validation)

**Files:**
- Create: `lib/mutations/field-schemas.ts`, `lib/mutations/field-schemas.test.ts`, `lib/mutations/models.ts`, `lib/actions/update-field.ts`, `components/editable-text.tsx`

- [ ] **Step 1: Test qui échoue pour `validateFieldUpdate`**

Create `lib/mutations/field-schemas.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateFieldUpdate } from './field-schemas';

describe('validateFieldUpdate', () => {
  it('valide et renvoie la valeur typée', () => {
    expect(validateFieldUpdate('product', 'prix', '12.5')).toBe(12.5);
    expect(validateFieldUpdate('genre', 'name', 'Polo')).toBe('Polo');
  });
  it('refuse une entité inconnue', () => {
    expect(() => validateFieldUpdate('hacker', 'x', '1')).toThrow();
  });
  it('refuse un champ non autorisé (allowlist)', () => {
    expect(() => validateFieldUpdate('product', 'passwordHash', 'x')).toThrow();
  });
  it('refuse une valeur invalide', () => {
    expect(() => validateFieldUpdate('product', 'prix', 'abc')).toThrow();
    expect(() => validateFieldUpdate('genre', 'name', '')).toThrow();
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec**

Run: `npx vitest run lib/mutations/field-schemas.test.ts`
Expected: FAIL — `validateFieldUpdate` introuvable.

- [ ] **Step 3: Implémenter les schémas + validation (module pur, sans Prisma)**

Create `lib/mutations/field-schemas.ts`:
```ts
import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' ? null : v), z.string().max(max).nullable());

export const fieldSchemas: Record<string, Record<string, z.ZodTypeAny>> = {
  site: {
    brandName: z.string().max(120),
    monogram: z.string().max(12),
    quoteEmail: z.union([z.string().email(), z.literal('')]),
  },
  genre: {
    name: z.string().min(1).max(120),
    description: optionalText(2000),
  },
  product: {
    designation: z.string().min(1).max(200),
    description: optionalText(5000),
    prix: z.coerce.number().min(0).max(999999),
    refInterne: optionalText(80),
    refFournisseur: optionalText(80),
    genreId: z.string().min(1),
    fabricColorId: z.union([z.string().min(1), z.literal(''), z.null()]).transform((v) => (v ? v : null)),
  },
};

export function validateFieldUpdate(entity: string, field: string, raw: unknown): unknown {
  const entityFields = fieldSchemas[entity];
  if (!entityFields) throw new Error(`Entité non éditable : ${entity}`);
  const schema = entityFields[field];
  if (!schema) throw new Error(`Champ non éditable : ${entity}.${field}`);
  return schema.parse(raw);
}
```

- [ ] **Step 4: Lancer, vérifier le succès**

Run: `npx vitest run lib/mutations/field-schemas.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Mapping entité → délégué Prisma**

Create `lib/mutations/models.ts`:
```ts
import { prisma } from '@/lib/db';

type ModelDef = {
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  revalidate: string;
};

export const models: Record<string, ModelDef> = {
  site: {
    update: (_id, data) => prisma.siteSettings.update({ where: { id: 1 }, data }),
    revalidate: '/',
  },
  genre: {
    update: (id, data) => prisma.genre.update({ where: { id }, data }),
    revalidate: '/',
  },
  product: {
    update: (id, data) => prisma.product.update({ where: { id }, data }),
    revalidate: '/',
  },
};
```

- [ ] **Step 6: Server Action générique**

Create `lib/actions/update-field.ts`:
```ts
'use server';
import { requireAdmin } from '@/lib/auth-guard';
import { validateFieldUpdate } from '@/lib/mutations/field-schemas';
import { models } from '@/lib/mutations/models';
import { revalidatePath } from 'next/cache';

export async function updateField(entity: string, id: string, field: string, raw: unknown) {
  await requireAdmin();
  const model = models[entity];
  if (!model) throw new Error(`Entité inconnue : ${entity}`);
  const value = validateFieldUpdate(entity, field, raw);
  await model.update(id, { [field]: value });
  revalidatePath(model.revalidate, 'layout');
  return { ok: true };
}
```

- [ ] **Step 7: Composants `<EditableText>` et `<EditableNumber>`**

Create `components/editable-text.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { useEditMode } from './edit-mode-provider';
import { updateField } from '@/lib/actions/update-field';
import { toast } from 'sonner';

type Common = { entity: string; entityId: string; field: string; placeholder?: string; className?: string };

export function EditableText({
  entity, entityId, field, value, placeholder = '—', multiline = false, className,
}: Common & { value: string | null; multiline?: boolean }) {
  const { editing } = useEditMode();
  const [val, setVal] = useState(value ?? '');
  if (!editing) return <span className={className}>{value || placeholder}</span>;

  async function commit() {
    if (val === (value ?? '')) return;
    try {
      await updateField(entity, entityId, field, val);
      toast.success('Enregistré');
    } catch {
      toast.error('Échec de l’enregistrement');
      setVal(value ?? '');
    }
  }
  const common = {
    value: val,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(e.target.value),
    onBlur: commit,
    placeholder,
    className,
    style: { border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-2)', padding: '2px 6px', background: 'transparent', font: 'inherit', color: 'inherit', width: '100%' as const },
  };
  return multiline
    ? <textarea {...common} rows={3} onKeyDown={() => {}} />
    : <input {...common} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

export function EditableNumber({
  entity, entityId, field, value, unit = '', placeholder = '0', className,
}: Common & { value: number | null; unit?: string }) {
  const { editing } = useEditMode();
  const [val, setVal] = useState(value != null ? String(value) : '');
  if (!editing) return <span className={className}>{value != null ? `${value}${unit ? ' ' + unit : ''}` : placeholder}</span>;

  async function commit() {
    try {
      await updateField(entity, entityId, field, val);
      toast.success('Enregistré');
    } catch {
      toast.error('Valeur invalide');
      setVal(value != null ? String(value) : '');
    }
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input inputMode="decimal" value={val}
        onChange={(e) => setVal(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder={placeholder} className={className}
        style={{ border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-2)', padding: '2px 6px', width: 90, font: 'inherit', color: 'inherit', background: 'transparent' }} />
      {unit && <span>{unit}</span>}
    </span>
  );
}
```

- [ ] **Step 8: Vérifier la compilation des tests + build type**

Run: `npm run test && npx tsc --noEmit`
Expected: tests PASS ; pas d'erreur TypeScript.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: generic updateField action with zod field allowlist + EditableText/Number"
```

---

## Task 5: Coquille catalogue (top-nav avec marque éditable)

**Files:**
- Create: `components/top-nav.tsx`, `app/catalogue/layout.tsx`

- [ ] **Step 1: Top-nav avec marque éditable**

Create `components/top-nav.tsx`:
```tsx
import Link from 'next/link';
import { EditableText } from './editable-text';

export function TopNav({ brandName, monogram }: { brandName: string; monogram: string }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
      borderBottom: '1px solid var(--brand-sage)', background: '#ffffffaa', backdropFilter: 'blur(6px)',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <Link href="/catalogue" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'var(--fg-1)' }}>
        <span style={{
          width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 'var(--r-3)',
          background: 'var(--brand-duck)', color: '#fff', fontWeight: 600, fontSize: 13,
        }}>
          <EditableText entity="site" entityId="1" field="monogram" value={monogram} placeholder="AB" />
        </span>
        <strong style={{ fontSize: 16 }}>
          <EditableText entity="site" entityId="1" field="brandName" value={brandName} placeholder="Nom de la maison" />
        </strong>
      </Link>
    </header>
  );
}
```

- [ ] **Step 2: Layout catalogue (top-nav + grille principale)** — la sidebar sera ajoutée en Task 6 ; pour l'instant un placeholder.

Create `app/catalogue/layout.tsx`:
```tsx
import { prisma } from '@/lib/db';
import { TopNav } from '@/components/top-nav';

export default async function CatalogueLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return (
    <div style={{ minHeight: '100dvh' }}>
      <TopNav brandName={settings.brandName} monogram={settings.monogram} />
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', alignItems: 'start' }}>
        <aside id="sidebar-slot" style={{ padding: 16, borderRight: '1px solid var(--brand-sage)', minHeight: '60dvh' }} />
        <main style={{ padding: 20 }}>{children}</main>
      </div>
    </div>
  );
}
```
> Note : la sidebar `<aside>` est remplie en Task 6 (on déplacera son contenu dans un composant `<Sidebar>` rendu ici).

- [ ] **Step 3: Vérification navigateur**

Run: `npm run dev` → `/catalogue` : top-nav visible. Connecté + mode édition : cliquer le nom de la maison, taper « Atelier Test », blur → toast « Enregistré » ; recharger → le nom persiste. Déconnecté : le nom s'affiche en lecture seule (pas d'input). Arrêter.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: catalogue shell with editable brand top-nav"
```

---

## Task 6: Sidebar + CRUD inline Genre + état vide

**Files:**
- Create: `lib/actions/genre.ts`, `components/new-entity-card.tsx`, `components/sidebar.tsx`, `components/empty-state.tsx`
- Modify: `app/catalogue/layout.tsx` (monter `<Sidebar>`), `app/catalogue/page.tsx`
- Create: `app/catalogue/[genreSlug]/page.tsx`

- [ ] **Step 1: Actions Genre (create/delete) avec slug unique**

Create `lib/actions/genre.ts`:
```ts
'use server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slug';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

async function uniqueGenreSlug(base: string): Promise<string> {
  let slug = base, n = 1;
  while (await prisma.genre.findUnique({ where: { slug } })) { n += 1; slug = `${base}-${n}`; }
  return slug;
}

export async function createGenre(name: string) {
  await requireAdmin();
  const clean = z.string().min(1).max(120).parse(name.trim());
  const slug = await uniqueGenreSlug(slugify(clean));
  const agg = await prisma.genre.aggregate({ _max: { position: true } });
  const genre = await prisma.genre.create({
    data: { name: clean, slug, position: (agg._max.position ?? -1) + 1 },
  });
  revalidatePath('/', 'layout');
  return { id: genre.id, slug: genre.slug };
}

export async function deleteGenre(id: string) {
  await requireAdmin();
  const count = await prisma.product.count({ where: { genreId: id, deletedAt: null } });
  if (count > 0) throw new Error('Cette famille contient des produits.');
  await prisma.genre.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return { ok: true };
}
```

- [ ] **Step 2: Carte fantôme générique « + Nouveau… »**

Create `components/new-entity-card.tsx`:
```tsx
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
```

- [ ] **Step 3: Sidebar (liste genres + carte fantôme)**

Create `components/sidebar.tsx`:
```tsx
'use client';
import Link from 'next/link';
import { NewEntityCard } from './new-entity-card';
import { createGenre } from '@/lib/actions/genre';

type GenreLink = { id: string; slug: string; name: string; count: number };

export function Sidebar({ genres, activeSlug }: { genres: GenreLink[]; activeSlug?: string }) {
  return (
    <nav style={{ display: 'grid', gap: 4 }}>
      <Link href="/catalogue" style={rowStyle(!activeSlug)}>Tous les produits</Link>
      {genres.map((g) => (
        <Link key={g.id} href={`/catalogue/${g.slug}`} style={rowStyle(activeSlug === g.slug)}>
          <span>{g.name}</span>
          <span className="micro-label" style={{ marginLeft: 'auto' }}>{g.count}</span>
        </Link>
      ))}
      <div style={{ marginTop: 8 }}>
        <NewEntityCard label="Nouvelle famille" asRow onCreate={(name) => createGenre(name)} />
      </div>
    </nav>
  );
}

function rowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--r-2)',
    textDecoration: 'none', color: active ? '#fff' : 'var(--fg-2)',
    background: active ? 'var(--brand-duck)' : 'transparent',
  };
}
```

- [ ] **Step 4: État vide**

Create `components/empty-state.tsx`:
```tsx
export function EmptyState() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: '12vh 0', color: 'var(--fg-3)' }}>
      <div style={{
        width: 96, height: 96, borderRadius: 'var(--r-6)', border: '2px dashed var(--brand-sage)',
        display: 'grid', placeItems: 'center', marginBottom: 16, color: 'var(--fg-4)',
      }}>T-shirt</div>
      <h2 style={{ color: 'var(--fg-1)', marginBottom: 6 }}>Votre catalogue est vide</h2>
      <p style={{ maxWidth: 420 }}>Commencez par créer une famille (T-shirt, Polo, Sweat…) dans la colonne de gauche, puis ajoutez votre premier produit.</p>
    </div>
  );
}
```

- [ ] **Step 5: Monter la Sidebar dans le layout**

Replace `app/catalogue/layout.tsx` with:
```tsx
import { prisma } from '@/lib/db';
import { TopNav } from '@/components/top-nav';
import { Sidebar } from '@/components/sidebar';

export default async function CatalogueLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const genres = await prisma.genre.findMany({
    orderBy: { position: 'asc' },
    select: { id: true, slug: true, name: true, _count: { select: { products: { where: { deletedAt: null } } } } },
  });
  const genreLinks = genres.map((g) => ({ id: g.id, slug: g.slug, name: g.name, count: g._count.products }));
  return (
    <div style={{ minHeight: '100dvh' }}>
      <TopNav brandName={settings.brandName} monogram={settings.monogram} />
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', alignItems: 'start' }}>
        <aside style={{ padding: 16, borderRight: '1px solid var(--brand-sage)', minHeight: '60dvh', position: 'sticky', top: 64 }}>
          <Sidebar genres={genreLinks} />
        </aside>
        <main style={{ padding: 20 }}>{children}</main>
      </div>
    </div>
  );
}
```
> Limitation connue (corrigée en Task 7) : `activeSlug` n'est pas encore passé. La sidebar fonctionne, juste sans surbrillance de la famille active. On le câblera quand la page genre lira ses produits.

- [ ] **Step 6: Page `/catalogue` minimale (état vide si aucun genre)**

Replace `app/catalogue/page.tsx` with:
```tsx
import { prisma } from '@/lib/db';
import { EmptyState } from '@/components/empty-state';

export default async function CataloguePage() {
  const genreCount = await prisma.genre.count();
  if (genreCount === 0) return <EmptyState />;
  return <p className="micro-label">Sélectionnez une famille ou ajoutez un produit (Task 7).</p>;
}
```

- [ ] **Step 7: Page genre (placeholder, complétée en Task 7)**

Create `app/catalogue/[genreSlug]/page.tsx`:
```tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { EditableText } from '@/components/editable-text';

export default async function GenrePage({ params }: { params: Promise<{ genreSlug: string }> }) {
  const { genreSlug } = await params;
  const genre = await prisma.genre.findUnique({ where: { slug: genreSlug } });
  if (!genre) notFound();
  return (
    <section>
      <h1 style={{ color: 'var(--fg-1)', marginBottom: 16 }}>
        <EditableText entity="genre" entityId={genre.id} field="name" value={genre.name} />
      </h1>
      <p className="micro-label">Produits de cette famille (Task 7).</p>
    </section>
  );
}
```

- [ ] **Step 8: Vérification navigateur (le cœur du MVP côté familles)**

Run: `npm run dev`, connecté en mode édition :
- `/catalogue` sans genre → état vide affiché.
- Sidebar → « Nouvelle famille » → taper « T-shirt » → Entrée → toast « Créé », la famille apparaît dans la sidebar avec compteur 0.
- Cliquer la famille → page genre, `<h1>` éditable ; renommer en « T-shirts » → blur → persiste après reload.
- Déconnecté : pas de carte « Nouvelle famille », noms en lecture seule.
Arrêter.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: sidebar + inline Genre create/delete + empty state"
```

---

## Task 7: CRUD Produit (carte, fiche détail, champs éditables)

**Files:**
- Create: `lib/actions/product.ts`, `components/editable-select.tsx`, `components/product-card.tsx`
- Modify: `app/catalogue/page.tsx`, `app/catalogue/[genreSlug]/page.tsx`
- Create: `app/catalogue/[genreSlug]/[productSlug]/page.tsx`

- [ ] **Step 1: Actions Produit (create sous un genre, soft-delete)**

Create `lib/actions/product.ts`:
```ts
'use server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slug';
import { revalidatePath } from 'next/cache';

async function uniqueProductSlug(base: string): Promise<string> {
  let slug = base, n = 1;
  while (await prisma.product.findUnique({ where: { slug } })) { n += 1; slug = `${base}-${n}`; }
  return slug;
}

export async function createProduct(genreId: string) {
  await requireAdmin();
  await prisma.genre.findUniqueOrThrow({ where: { id: genreId } });
  const slug = await uniqueProductSlug(slugify('nouveau-produit'));
  const agg = await prisma.product.aggregate({ where: { genreId }, _max: { position: true } });
  const p = await prisma.product.create({
    data: { genreId, slug, designation: 'Nouveau produit', prix: 0, published: true, position: (agg._max.position ?? -1) + 1 },
  });
  revalidatePath('/', 'layout');
  return { id: p.id, slug: p.slug };
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/', 'layout');
  return { ok: true };
}
```

- [ ] **Step 2: `<EditableSelect>` (pour réaffecter le genre d'un produit)**

Create `components/editable-select.tsx`:
```tsx
'use client';
import { useEditMode } from './edit-mode-provider';
import { updateField } from '@/lib/actions/update-field';
import { toast } from 'sonner';

type Option = { value: string; label: string };

export function EditableSelect({
  entity, entityId, field, value, options, className,
}: { entity: string; entityId: string; field: string; value: string | null; options: Option[]; className?: string }) {
  const { editing } = useEditMode();
  const current = options.find((o) => o.value === value);
  if (!editing) return <span className={className}>{current?.label ?? '—'}</span>;
  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    try { await updateField(entity, entityId, field, e.target.value); toast.success('Enregistré'); }
    catch { toast.error('Échec de l’enregistrement'); }
  }
  return (
    <select defaultValue={value ?? ''} onChange={onChange} className={className}
      style={{ font: 'inherit', padding: '4px 6px', border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-2)', background: 'transparent' }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
```

- [ ] **Step 3: Carte produit (+ suppression via mode édition)**

Create `components/product-card.tsx`:
```tsx
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
```

- [ ] **Step 4: Grille réutilisable dans les pages catalogue + genre**

Replace `app/catalogue/page.tsx` with:
```tsx
import { prisma } from '@/lib/db';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';

export default async function CataloguePage() {
  const genreCount = await prisma.genre.count();
  if (genreCount === 0) return <EmptyState />;
  const products = await prisma.product.findMany({
    where: { deletedAt: null, published: true },
    orderBy: [{ genreId: 'asc' }, { position: 'asc' }],
    include: { genre: { select: { slug: true } } },
  });
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
      {products.map((p) => (
        <ProductCard key={p.id} p={{ id: p.id, slug: p.slug, designation: p.designation, prix: p.prix.toFixed(2), refInterne: p.refInterne, genreSlug: p.genre.slug }} />
      ))}
    </section>
  );
}
```

- [ ] **Step 5: Composant client « + Nouveau produit » (crée puis redirige vers la fiche)**

`createProduct(genreId)` ne prend pas de nom (le produit naît « Nouveau produit » et s'édite ensuite inline), donc on utilise un composant dédié plutôt que `NewEntityCard`.

Create `components/new-product-card.tsx`:
```tsx
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
```

- [ ] **Step 6: Page genre = grille filtrée + carte « + Nouveau produit »**

Replace `app/catalogue/[genreSlug]/page.tsx` with:
```tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { EditableText } from '@/components/editable-text';
import { ProductCard } from '@/components/product-card';
import { NewProductCard } from '@/components/new-product-card';

export default async function GenrePage({ params }: { params: Promise<{ genreSlug: string }> }) {
  const { genreSlug } = await params;
  const genre = await prisma.genre.findUnique({ where: { slug: genreSlug } });
  if (!genre) notFound();
  const products = await prisma.product.findMany({
    where: { genreId: genre.id, deletedAt: null },
    orderBy: { position: 'asc' },
  });
  return (
    <section>
      <h1 style={{ color: 'var(--fg-1)', marginBottom: 16 }}>
        <EditableText entity="genre" entityId={genre.id} field="name" value={genre.name} />
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {products.map((p) => (
          <ProductCard key={p.id} p={{ id: p.id, slug: p.slug, designation: p.designation, prix: p.prix.toFixed(2), refInterne: p.refInterne, genreSlug: genre.slug }} />
        ))}
        <NewProductCard genreId={genre.id} genreSlug={genre.slug} />
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Fiche détail produit (champs éditables)**

Create `app/catalogue/[genreSlug]/[productSlug]/page.tsx`:
```tsx
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { EditableText, EditableNumber } from '@/components/editable-text';
import { EditableSelect } from '@/components/editable-select';

export default async function ProductPage({ params }: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await params;
  const product = await prisma.product.findUnique({ where: { slug: productSlug } });
  if (!product || product.deletedAt) notFound();
  const genres = await prisma.genre.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true } });

  return (
    <article style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 }}>
      <div style={{ aspectRatio: '4 / 3', borderRadius: 'var(--r-5)', background: 'var(--brand-linen)' }} />
      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <h1 style={{ color: 'var(--fg-1)' }}>
          <EditableText entity="product" entityId={product.id} field="designation" value={product.designation} />
        </h1>
        <div>
          <span className="micro-label">Famille</span><br />
          <EditableSelect entity="product" entityId={product.id} field="genreId" value={product.genreId}
            options={genres.map((g) => ({ value: g.id, label: g.name }))} />
        </div>
        <div>
          <span className="micro-label">Prix</span><br />
          <EditableNumber entity="product" entityId={product.id} field="prix" value={Number(product.prix)} unit="€" />
        </div>
        <div>
          <span className="micro-label">Réf. interne</span><br />
          <EditableText entity="product" entityId={product.id} field="refInterne" value={product.refInterne} placeholder="—" />
        </div>
        <div>
          <span className="micro-label">Réf. fournisseur</span><br />
          <EditableText entity="product" entityId={product.id} field="refFournisseur" value={product.refFournisseur} placeholder="—" />
        </div>
        <div>
          <span className="micro-label">Description</span>
          <EditableText entity="product" entityId={product.id} field="description" value={product.description} multiline placeholder="Décrivez le produit…" />
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 8: Build de type + tests**

Run: `npm run test && npx tsc --noEmit`
Expected: tests PASS ; aucune erreur TypeScript (notamment plus de référence à l'ancienne fonction locale `NewProductCard`).

- [ ] **Step 9: Vérification navigateur (parcours complet MVP)**

Run: `npm run dev`, connecté en mode édition :
- Aller dans une famille → « Nouveau produit » → redirection vers la fiche du produit créé.
- Éditer désignation, prix (12,90), réf interne, description → chaque blur → toast « Enregistré ».
- Changer la famille via le select → le produit migre, vérifier qu'il apparaît dans l'autre famille.
- Retour `/catalogue` → la carte montre désignation + prix + réf ; bouton corbeille supprime (soft) → le produit disparaît.
- Déconnecté : fiches en lecture seule, pas de carte « Nouveau produit », pas de corbeille.
Arrêter.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: Product create/soft-delete, card, detail page with inline editable fields"
```

---

## Task 8: Préparation et déploiement Railway

**Files:**
- Create: `railway.json`, `start.sh`, `.env.example`
- Modify: `package.json` (scripts build/start)

- [ ] **Step 1: Scripts de build/start**

Edit `package.json` scripts to:
```json
"scripts": {
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start -p ${PORT:-3000} -H 0.0.0.0",
  "lint": "eslint",
  "test": "vitest run",
  "db:migrate": "prisma migrate deploy",
  "db:seed": "node --import tsx prisma/seed.ts"
}
```

- [ ] **Step 2: Script de release (migrations + seed idempotent + start)**

Create `start.sh`:
```sh
#!/bin/sh
set -e
npx prisma migrate deploy
npm run db:seed
npm run start
```
Run: `chmod +x start.sh`.

- [ ] **Step 3: Config Railway**

Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS", "buildCommand": "npm run build" },
  "deploy": {
    "startCommand": "sh start.sh",
    "healthcheckPath": "/login",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE"
  }
}
```
> `healthcheckPath` = `/login` car `/` redirige (302) et `/catalogue` interroge la DB ; `/login` est statique et rapide.

- [ ] **Step 4: `.env.example`**

Create `.env.example`:
```
# Base de données (fournie par le plugin Postgres Railway en prod)
DATABASE_URL="postgresql://user:password@localhost:5432/textileb2b?schema=public"

# Auth.js v5
AUTH_SECRET="genere-avec: npx auth secret"
# AUTH_URL="https://ton-domaine"   # optionnel si trustHost

# Compte admin initial (utilisé par le seed ; retirer ADMIN_PASSWORD après le 1er boot)
ADMIN_EMAIL="patron@maison.fr"
ADMIN_PASSWORD="a-changer"

# Stockage images : "local" pour le MVP (R2 plus tard en Plan 2)
STORAGE="local"
```

- [ ] **Step 5: Vérifier le build de production en local**

Run: `npm run build`
Expected: build réussi (`prisma generate` + `next build` sans erreur). Si erreur de type/route, corriger avant de déployer.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: Railway deploy config (build/start, healthcheck, env example)"
```

- [ ] **Step 7: Provisionnement Railway (action externe — demander le feu vert à l'utilisateur)**

> **STOP — ressources externes.** Créer le repo GitHub + le projet Railway + la base Postgres sont des actions externes. Demander confirmation à l'utilisateur, puis utiliser le skill **`use-railway`** pour : créer le projet, ajouter le plugin Postgres, définir les variables (`AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `STORAGE=local`), connecter le dépôt et lancer le déploiement. (Le repo GitHub `dockbearolda/...` peut être créé via `gh repo create`.)

- [ ] **Step 8: Smoke test post-déploiement**

Après déploiement : ouvrir l'URL Railway → `/login`, se connecter avec `ADMIN_EMAIL`/`ADMIN_PASSWORD` → créer une famille + un produit → vérifier la persistance après reload. Puis **retirer la variable `ADMIN_PASSWORD`** de Railway (le compte est créé).

---

## Self-Review (effectué)

**1. Couverture du spec (périmètre Plan 1) :**
- Scaffold/tokens/redirect → Task 1 ✓
- Schéma Prisma complet + seed admin + vide à l'installation → Task 2 ✓ (aucun genre/produit seedé)
- Auth NextAuth v5 + login + requireAdmin → Task 3 ✓
- Mode édition (data-edit-mode, barre flottante, toggle, voir-comme-client via toggle, déconnexion) → Task 3 ✓
- « admin = copie du site », Server Action générique `updateField` + zod par entité + EditableText/Number/Select → Tasks 4, 7 ✓
- Top-nav marque éditable, sidebar genres + compteur + carte fantôme, état vide → Tasks 5, 6 ✓
- CRUD Genre (créer/renommer/supprimer avec refus si non vide) → Task 6 ✓ (réordonner → Plan 2)
- CRUD Produit (créer/éditer champs/soft-delete) + carte + fiche → Task 7 ✓ (dupliquer, publier/brouillon UI → Plan 2)
- Déploiement Railway → Task 8 ✓
- **Hors périmètre (Plan 2), volontairement absents :** FabricColor/Size/ProductSize UI, images/sharp/adaptateur stockage, logos, recherche/filtres/tri, dupliquer, brouillon-publié UI, export/import CSV, drag-reorder, « Demander un devis ».

**2. Placeholders :** aucun « TODO/TBD » de code. Les deux étapes 5→6 de Task 7 montrent une correction explicite (carte produit) avec le code complet du remplacement, pas un placeholder.

**3. Cohérence des types :** `updateField(entity, id, field, raw)` identique partout ; `EditableText` reçoit `value: string | null`, `EditableNumber` `value: number | null` (la fiche passe `Number(product.prix)`) ; `ProductCard` reçoit `prix: string` (`p.prix.toFixed(2)`) ; actions renvoient `{ id, slug }` utilisées par `NewProductCard`. `models[entity].update(id, data)` cohérent avec `field-schemas`.

**4. Ambiguïté :** `published` par défaut `true` au MVP explicité ; `healthcheckPath=/login` justifié ; sidebar `activeSlug` non câblé = limitation cosmétique documentée (Task 6 Step 5).
