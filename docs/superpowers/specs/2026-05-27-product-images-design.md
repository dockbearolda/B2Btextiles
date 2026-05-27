# Textile B2B — Plan 2 · Étape 1 : Photos produits

> Premier incrément du Plan 2. Objectif : permettre à l'admin d'ajouter des **photos** aux produits (upload, galerie, suppression, choix de la principale), affichées sur les cartes et la fiche produit, visibles par les clients. Pose aussi le **socle de stockage de fichiers** réutilisé ensuite par les logos.

**Stack ajoutée :** `sharp` (déjà présent — à déclarer en dépendance), un **adaptateur de stockage** maison, un **volume persistant Railway** pour les fichiers en prod.

---

## Périmètre

**Dans cet incrément :**
- Upload d'une ou plusieurs images sur un produit (mode édition).
- Traitement à l'upload : validation (type image), redimensionnement (cap ~1600 px), génération d'une vignette (~500 px), conversion en **WebP**, suppression des métadonnées, capture largeur/hauteur.
- Stockage via un **adaptateur** (`local` d'abord, sur volume Railway ; R2/bucket plus tard sans changer le reste du code).
- Affichage : **image principale** sur la carte produit + **galerie** sur la fiche (vignette → grande image), avec repli sur le placeholder actuel si aucune image.
- Gestion en mode édition sur la fiche : ajouter, supprimer, définir la principale, réordonner (boutons simples ↑/↓).

**Hors périmètre (incréments suivants) :**
- Mockups / superposition de logos sur les photos → étape **Logos**.
- Images par couleur/déclinaison → étape **Couleurs & tailles**.
- Stockage objet (Cloudflare R2 / bucket Railway) → reporté ; l'adaptateur est prévu pour l'accueillir.
- Recadrage/édition d'image côté navigateur, glisser-déposer avancé.

---

## Architecture

### 1. Adaptateur de stockage (`lib/storage/`)
Interface unique, indépendante du backend :
```
saveImage(buffer, { ext }) -> { key, url }   // écrit le fichier, renvoie clé + chemin public
deleteImage(key) -> void
readImage(key) -> stream + contentType        // pour servir le fichier
```
- Implémentation `local` (v1) : écrit sous un dossier configurable `UPLOAD_DIR` (déf. `./public/uploads` en dev, `/data/uploads` = volume en prod). La clé = nom de fichier (`<cuid>.webp`), l'URL publique = `/uploads/<fichier>`.
- Sélection par `STORAGE` (déjà à `local`). Une future impl. `r2`/`bucket` se branche sans toucher au reste.
- **Pourquoi un volume et pas le disque du conteneur :** sur Railway le disque est éphémère (réinitialisé à chaque déploiement) → les fichiers seraient perdus. Un **volume persistant** monté sur `/data` règle ça.

### 2. Upload (route handler — pas server action)
- `POST app/api/products/[id]/images/route.ts`, `multipart/form-data`, accepte 1..N fichiers.
- Garde admin : vérifie la session (`getIsAdmin()`), sinon 401. (Les server actions du projet utilisent `requireAdmin()` qui `throw` ; côté route on renvoie un code HTTP.)
- Pour chaque fichier : valider que c'est une image (sharp `metadata()`), refuser sinon ; produire **full** (cap 1600 px, WebP q80, sans métadonnées) + **thumb** (cap 500 px) ; écrire via l'adaptateur ; créer une ligne `ProductImage` (url, width, height, position = max+1).
- Limite de taille raisonnable (ex. 8 Mo/fichier) renvoyant une erreur claire.
- *Raison du route handler plutôt qu'un server action :* les server actions ont une limite de corps par défaut (1 Mo) et sont moins adaptées au binaire ; un route handler gère proprement le multipart et des fichiers plus lourds.

### 3. Service des fichiers
- `GET app/uploads/[...path]/route.ts` lit le fichier via l'adaptateur et le renvoie avec `Content-Type` + `Cache-Control` long (immuable, nom hashé).
- *Pourquoi une route et pas `/public` :* les fichiers écrits au runtime ne sont pas servis de façon fiable par le `/public` statique de Next en production.
- Convention vignette : `<base>.webp` (full) et `<base>.thumb.webp` (vignette), dérivée du nom — pas de changement de modèle.

### 4. Suppression / réordonnancement / principale (server actions)
- Actions dédiées (`lib/actions/product-image.ts`) cohérentes avec le pattern existant : `deleteProductImage(id)`, `moveProductImage(id, dir)`, `setPrimaryImage(id)` — chacune `requireAdmin()` + maj Prisma + `revalidatePath`. La **principale** = `position` 0 (affichée sur la carte).

### 5. Affichage
- **Carte produit** (`components/product-card.tsx`) : remplace le placeholder par la **vignette** de l'image `position` 0 ; repli placeholder si aucune.
- **Fiche** (`app/catalogue/[genreSlug]/[productSlug]/page.tsx`) : galerie — grande image + bande de vignettes ; en mode édition, zone d'upload + boutons supprimer/principale/réordonner. Composant client `components/product-gallery.tsx`.
- Rendu via `<img>` sur les chemins servis (`/uploads/...`) ; vignettes sur les cartes pour la performance. (Optimisation `next/image` possible plus tard, non requise ici.)

---

## Données
Le modèle **`ProductImage`** existe déjà (`id, productId, url, width, height, position`, `onDelete: Cascade`). Aucune migration nécessaire pour cet incrément. `url` stocke le chemin public du **full** ; la vignette est dérivée par convention.

## Infra Railway
- Créer un **volume persistant** attaché au service `web`, monté sur `/data`.
- Variable `UPLOAD_DIR=/data/uploads` (prod). Le dossier est créé au démarrage si absent.
- `STORAGE=local` déjà en place. (Action externe — provisionnement du volume — faite à l'implémentation.)

## Gestion d'erreurs
- Fichier non-image ou trop gros → message clair (toast côté client, statut HTTP côté route).
- Échec d'écriture disque → l'upload renvoie une erreur, aucune ligne `ProductImage` orpheline (créée seulement après écriture réussie).
- Suppression d'une image → supprime la ligne **et** les fichiers (full + thumb) ; tolère un fichier déjà absent.

## Tests (vitest, unités pures)
- Génération de clé/nom de fichier (extension forcée `.webp`, dérivation `.thumb`).
- Logique de validation/typage (taille, type accepté) isolée du système de fichiers.
- (Le rendu et l'upload réel sont vérifiés en navigateur + en prod, conformément au workflow du projet.)

## Décisions par défaut (modifiables)
- Formats acceptés : JPEG, PNG, WebP, AVIF → sortie **WebP**.
- Tailles : full ≤ 1600 px, vignette ≤ 500 px (plus grand côté).
- Plusieurs images par produit, principale = la première (réordonnable).
- Stockage **local/volume** d'abord ; R2/bucket plus tard via le même adaptateur.
