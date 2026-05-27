import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { EditableText } from '@/components/editable-text';
import { ProductCard } from '@/components/product-card';
import { NewProductCard } from '@/components/new-product-card';
import { thumbUrlFromUrl } from '@/lib/images/keys';

export default async function GenrePage({ params }: { params: Promise<{ genreSlug: string }> }) {
  const { genreSlug } = await params;
  const genre = await prisma.genre.findUnique({ where: { slug: genreSlug } });
  if (!genre) notFound();
  const products = await prisma.product.findMany({
    where: { genreId: genre.id, deletedAt: null },
    orderBy: { position: 'asc' },
    include: { images: { orderBy: { position: 'asc' }, take: 1 } },
  });
  return (
    <section>
      <h1 style={{ color: 'var(--fg-1)', marginBottom: 16 }}>
        <EditableText entity="genre" entityId={genre.id} field="name" value={genre.name} />
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
        {products.map((p) => (
          <ProductCard key={p.id} p={{ id: p.id, slug: p.slug, designation: p.designation, prix: p.prix.toFixed(2), refInterne: p.refInterne, genreSlug: genre.slug, imageUrl: p.images[0] ? thumbUrlFromUrl(p.images[0].url) : null }} />
        ))}
        <NewProductCard genreId={genre.id} genreSlug={genre.slug} />
      </div>
    </section>
  );
}
