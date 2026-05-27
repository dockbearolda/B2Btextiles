import { prisma } from '@/lib/db';
import { EmptyState } from '@/components/empty-state';
import { ProductCard } from '@/components/product-card';
import { thumbUrlFromUrl } from '@/lib/images/keys';

export default async function CataloguePage() {
  const genreCount = await prisma.genre.count();
  if (genreCount === 0) return <EmptyState />;
  const products = await prisma.product.findMany({
    where: { deletedAt: null, published: true },
    orderBy: [{ genre: { position: 'asc' } }, { position: 'asc' }],
    include: { genre: { select: { slug: true } }, images: { orderBy: { position: 'asc' }, take: 1 } },
  });
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
      {products.map((p) => (
        <ProductCard key={p.id} p={{ id: p.id, slug: p.slug, designation: p.designation, prix: p.prix.toFixed(2), refInterne: p.refInterne, genreSlug: p.genre.slug, imageUrl: p.images[0] ? thumbUrlFromUrl(p.images[0].url) : null }} />
      ))}
    </section>
  );
}
