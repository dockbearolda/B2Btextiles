import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { EditableText, EditableNumber } from '@/components/editable-text';
import { EditableSelect } from '@/components/editable-select';
import { ProductGallery } from '@/components/product-gallery';
import { thumbUrlFromUrl } from '@/lib/images/keys';

export default async function ProductPage({ params }: { params: Promise<{ productSlug: string }> }) {
  const { productSlug } = await params;
  const product = await prisma.product.findUnique({ where: { slug: productSlug }, include: { images: { orderBy: { position: 'asc' } } } });
  if (!product || product.deletedAt) notFound();
  const genres = await prisma.genre.findMany({ orderBy: { position: 'asc' }, select: { id: true, name: true } });

  return (
    <article style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, maxWidth: 900 }}>
      <ProductGallery productId={product.id} images={product.images.map((i) => ({ id: i.id, url: i.url, thumbUrl: thumbUrlFromUrl(i.url), width: i.width, height: i.height, position: i.position, offsetX: i.offsetX, offsetY: i.offsetY, scale: i.scale }))} />
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
