# Design — Catalogue B2B « Textile B2B » (Atelier)

> Date : 2026-05-26
> Statut : validé pour passage au plan d'implémentation
> Source : `~/Downloads/PROMPT-ATELIER.md` + décisions de cadrage (voir §0)

## 0 · Décisions de cadrage (ce qui a été tranché avec l'utilisateur)

- **Build neuf**, de zéro, dans `/Users/charlie/Desktop/Textile B2B`. On ne touche pas au site existant `SITE-B2B-main` (déployé, archi différente : dashboard `/admin` séparé, comptes clients, prix public/revendeur).
- **Un seul prix par produit**, visible par tous. Pas de comptes clients, pas de tarif revendeur. Devis par mail.
- **Stockage photos : Railway-first** (disque + volume Railway), derrière un **adaptateur interchangeable**. Cloudflare R2 branchable plus tard via variables d'env, sans réécriture. (L'utilisateur n'a pas de compte R2 aujourd'hui.)
- **Repo git dédié** initialisé dans le dossier projet (le home `/Users/charlie` est lui-même un repo git ; on ne veut pas committer dedans). GitHub + projet Railway créés plus tard, sur feu vert explicite.

## 1 · Brief

App **catalogue B2B textile** déployable sur Railway, **vide à l'installation**. Le patron crée/édite/publie tous les contenus (genres, produits, mockups, prix, tailles, stocks, logos, couleurs textile) **depuis une interface admin qui est la copie exacte du site public** : il navigue son catalogue comme un client, et une fois connecté, chaque élément devient éditable en ligne (affordances « + » et « ✎ »).

### Objectifs

- **Public (sans login)** : catalogue propre et navigable — genres en sidebar, grille de fiches (mockup, prix, refs, tailles, stock), fiche détail.
- **Admin (1 login partagé)** : **exactement la même UI** + affordances d'édition. Pas de dashboard séparé.
- **Vide à l'installation** : zéro donnée seed sauf le compte admin (créé via variables d'env).

### Non-objectifs (hors MVP)

Pas de panier / commande en ligne, pas de multi-utilisateurs, pas de multilingue (FR only), pas de pixel-perfect Figma (on itère en preview Railway), pas de SEO avancé, pas de paiement.

## 2 · Stack (finalisée)

| Domaine | Choix | Note |
|---|---|---|
| Framework | **Next.js 16** (App Router, Server Components, Server Actions) | Dernière stable, comme le site existant. Supersède le « 15 » du spec. |
| Langage | **TypeScript strict** | |
| DB | **Postgres + Prisma 6** | Plugin Postgres Railway en prod. |
| Auth | **Auth.js (NextAuth v5)** Credentials | 1 rôle `ADMIN`, pas de signup public. |
| Hash mot de passe | **argon2** via `@node-rs/argon2` | Variante précompilée → builds Railway fiables (pas de node-gyp). |
| UI | **Tailwind v4** + composants maison | Pas de shadcn. |
| Icônes | **lucide-react** | stroke 1.6–2.0, pas d'emoji, pas d'icône custom. |
| Images | **next/image + sharp** | 3 tailles à l'upload : thumb 240 / card 480 / full 1200, en `.webp`. |
| Validation | **zod** | Un schéma par entité, partagé client/serveur. |
| Toasts | **sonner** | |

## 3 · Architecture « admin = copie du site »

C'est la décision structurante. **Une seule arborescence de pages**, pas de `/admin/*` séparé.

```
app/
  layout.tsx              ← lit la session, expose isAdmin via contexte ; pose data-edit-mode sur <body>
  page.tsx                ← redirige vers /catalogue
  catalogue/
    page.tsx              ← grille de tous les produits publiés
    [genreSlug]/
      page.tsx            ← grille filtrée par genre
      [productSlug]/
        page.tsx          ← fiche détail produit
  login/
    page.tsx              ← seul écran « vraiment » admin
  logos/
    page.tsx              ← bibliothèque de logos (admin)
```

### Mode édition

- Si `session.user.role === 'ADMIN'` : le layout pose `data-edit-mode="on"` sur `<body>`, affiche une **barre flottante** (bottom-right) : toggle « Mode édition » (ON par défaut), « Voir comme un client » (preview public), « Déconnexion ».
- Mode édition actif → affordances partout : textes éditables (cadre au survol, bascule en input), listes avec carte fantôme « + Nouveau… », cartes produit avec kebab (Modifier · Dupliquer · Archiver · Supprimer), images en dropzone.
- Mode public (déconnecté ou toggle off) → **aucune** affordance. Catalogue tel que vu par les clients.

### Couche mutations — hybride (décision technique)

Plutôt que tout-générique ou tout-spécifique :

- **`updateField(entity, id, field, value)`** générique : pour les éditions de champ inline uniformes (texte, nombre, select). Sécurisé par une **allowlist de champs par entité** + schéma zod par entité + `requireAdmin()`.
- **Actions dédiées et typées** pour les opérations structurelles à risque : `createGenre`, `deleteGenre`, `reorderGenres`, `createProduct`, `duplicateProduct`, `deleteProduct` (soft), `setPublished`, `uploadProductImages`, `reorderProductImages`, `deleteProductImage`, `setProductSizes`, `createFabricColor`, `createSize`, `createLogo`, etc.

Toutes les actions de mutation commencent par `requireAdmin()`.

### Composants d'édition (factorisés)

`<EditableText>`, `<EditableNumber unit>`, `<EditableSelect allowCreate>`, `<EditableImage slot maxCount>`, `<EditableSizeList>`, `<EditableColorChip>`, `<NewEntityCard entity parentId>`. Chacun prend `entity`/`field`/`entityId` et, pour les champs simples, appelle `updateField`.

## 4 · Modèle de données (Prisma)

Reprend le spec, avec **deux ajouts** (voir §0/§ ajustements) : `SiteSettings` et `Product.deletedAt`.

```prisma
model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}

model SiteSettings {              // AJOUT : nom de la maison / monogramme / email devis, éditables en ligne
  id           Int     @id @default(1)   // singleton
  brandName    String  @default("")
  monogram     String  @default("")      // initiales / petit texte du logo top-nav
  quoteEmail   String  @default("")      // destinataire du mailto "Demander un devis"
  updatedAt    DateTime @updatedAt
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
  id       String   @id @default(cuid())
  name     String
  hex      String
  position Int      @default(0)
  products Product[]
}

model Size {
  id       String   @id @default(cuid())
  label    String   @unique            // "S", "M", "3-4 ans", "Unique"
  position Int      @default(0)
}

model Product {
  id             String   @id @default(cuid())
  slug           String   @unique
  designation    String
  description    String?  @db.Text
  refInterne     String?  @unique
  refFournisseur String?
  prix           Decimal  @db.Decimal(8, 2)
  published      Boolean  @default(false)
  deletedAt      DateTime?                 // AJOUT : soft-delete (corbeille)

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
  stock     Int      @default(0)
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  size      Size     @relation(fields: [sizeId], references: [id])
  @@id([productId, sizeId])
}

model ProductImage {
  id        String   @id @default(cuid())
  productId String
  url       String                  // chemin renvoyé par l'adaptateur de stockage
  width     Int
  height    Int
  position  Int      @default(0)    // 0 = image principale
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
}

model Logo {
  id        String   @id @default(cuid())
  name      String
  kind      LogoKind                // MONO | MULTI
  url       String
  monoColor String?                 // hex si MONO
  colors    String[]                // hex[] si MULTI (lecture seule)
  position  Int      @default(0)
  products  Product[]
}

enum LogoKind { MONO MULTI }
```

Notes :
- **Tailles** et **couleurs** = tables à part → le patron compose librement sa palette / ses tailles.
- **Stock par taille** via `ProductSize`. Si non utilisé (0 partout) → rien d'affiché côté public.
- **`published`** : un brouillon n'apparaît pas en public mais reste visible en édition avec bandeau « Brouillon ».
- **`deletedAt`** : suppression douce ; les produits supprimés sont exclus partout sauf vue corbeille (post-MVP éventuel).

## 5 · Stockage images (adaptateur)

Interface `StorageAdapter { put(key, bytes, contentType): Promise<url>; delete(key): Promise<void> }` avec deux implémentations :

- **`local`** (défaut dev + Railway-first) : écrit dans `public/uploads/`, persistant en prod via **volume Railway**.
- **`r2`** (plus tard) : S3-compatible Cloudflare R2, activé par `STORAGE=r2` + variables `R2_*`.

Flux upload : Server Action → multipart parsé serveur → `sharp` génère 3 variantes `{id}-{thumb|card|full}.webp` → `adapter.put` → enregistre `ProductImage`. Preview instantané côté client via `URL.createObjectURL`, remplacé par l'URL finale après upload.

## 6 · Auth

- Auth.js v5 Credentials. Session **JWT cookie httpOnly, 30 jours**.
- 1 `AdminUser` seedé depuis `ADMIN_EMAIL` / `ADMIN_PASSWORD` au premier démarrage (puis on retire `ADMIN_PASSWORD`).
- Rôle unique `ADMIN`. Toutes les Server Actions de mutation : `requireAdmin()` en tête.
- Rate-limit basique sur `/login`. Pas de « mot de passe oublié » au MVP (reset manuel en DB).

## 7 · Pages

- **`/catalogue`** : top-nav (monogramme + nom de maison éditables, recherche, bouton Connexion/avatar) ; sidebar (genres triés par position + badge compteur, « Tous les produits », palette couleurs cliquable en filtre, en édition : « + Nouveau genre » + drag-reorder) ; main (chips de filtres actifs, toggle grille/liste, grille `auto-fit minmax(220px,1fr)`, cartes produit, en édition : carte fantôme « + Nouveau produit »).
- **`/catalogue/[genreSlug]`** : idem filtré, `<h1>` = `EditableText` sur `Genre.name`.
- **`/catalogue/[genreSlug]/[productSlug]`** : galerie mockups (carrousel + thumbs), désignation/description/refs/couleur/prix/tailles (+stock si renseigné)/logo, bouton « Demander un devis » (mailto vers `SiteSettings.quoteEmail`). En édition : tout inline + bouton « Dupliquer ».
- **`/login`** : email + password.
- **`/logos`** : bibliothèque logos (admin), upload SVG/PNG, MONO (couleur unique) ou MULTI.

## 8 · Fonctionnalités admin (depuis le site)

Créer/renommer/réordonner/supprimer un genre ; créer/éditer/dupliquer/publier/supprimer (soft) un produit ; uploader/réordonner mockups ; ajouter taille / couleur ; créer logo ; export CSV ; import CSV (wizard 2 étapes mapping→preview, **reporté en v1.1**). Suppression d'un genre refusée s'il contient des produits non archivés (confirm modal).

## 9 · Design system

Palette « Duck Blue + Sage », glassmorphism léger, system fonts. Tokens dans `app/globals.css` :

```css
--brand-duck:#4A6274; --brand-duck-300:#6B8191; --brand-sage:#CDD4CD;
--brand-linen:#EBEAE8; --brand-paper:#f4f4f2;
--fg-1:#202930; --fg-2:#2f3b45; --fg-3:#556876; --fg-4:#8BA0AF;
--r-1..r-6:6/8/10/12/16/20px;
--shadow-1:0 1px 2px rgba(74,98,116,0.04);
--ease-snap:cubic-bezier(0.32,0.72,0,1);
```

- Typo system stack. **Tabular nums toujours** sur prix/refs/dates/stocks.
- Radius : cartes 12, modals 16, pills 9999. Micro-labels caps 10–11px, letter-spacing 0.06–0.10em, `--fg-4`.
- **Mode édition** : fond légèrement plus chaud (`#f6f3ec`) ; affordances en `--brand-duck-300` (hover / dashed border).

## 10 · État vide (vraiment vierge)

Premier démarrage, en mode édition : sidebar = un seul lien « + Créer ma première famille » ; main = wireframe t-shirt + texte « Votre catalogue est vide… » + boutons « Créer une famille » / « Importer un CSV ». Aucun seed sauf `AdminUser`.

## 11 · Déploiement Railway

Une seule app web Next.js + Postgres Railway. Variables :

```
DATABASE_URL=…
AUTH_SECRET=…
AUTH_URL=https://…              # NextAuth v5
ADMIN_EMAIL=…
ADMIN_PASSWORD=…                # une fois au seed, retirer ensuite
STORAGE=local                   # "r2" plus tard
# (si R2 plus tard) R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_URL
```

Build : `prisma generate && next build`. Release : `prisma migrate deploy`. Volume Railway monté sur `public/uploads` pour le stockage local. Domaine custom après mise en prod.

## 12 · Ordre de construction (commit après chaque étape)

1. Scaffold Next 16 + Prisma + Tailwind v4 + tokens + layout vide.
2. Schéma Prisma + migration initiale + seed admin.
3. Auth NextAuth + `/login` + `requireAdmin`.
4. Layout site + top-nav + sidebar (lecture seule).
5. CRUD `Genre` (Server Actions) + `EditableText` + `NewEntityCard` sidebar.
6. CRUD `Product` (designation, description, prix, refs) + carte + fiche détail.
7. `FabricColor` + `Size` + `ProductSize` (stock) + composants éditables. **← MVP utilisable.**
8. Upload images (adaptateur local) + `EditableImage` + sharp 3 tailles.
9. `Logo` + page bibliothèque + association produit.
10. Recherche + filtres (genre/couleur/taille) + tri.
11. Mode édition complet : toggle, barre flottante, affordances partout.
12. Brouillon/publié, soft-delete, dupliquer.
13. Export CSV.
14. Import CSV (v1.1).

## 13 · Reporté / à confirmer plus tard

- **Cloudflare R2** : adaptateur prêt, activé quand l'utilisateur fournit les clés.
- **Import CSV** : v1.1.
- **Formulaire de devis** réel (vs mailto) : éventuellement via le compte Resend existant.
- **GitHub + projet Railway** : créés sur feu vert explicite (ressources externes).
