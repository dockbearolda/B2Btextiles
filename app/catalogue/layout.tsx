import { prisma } from '@/lib/db';
import { TopNav } from '@/components/top-nav';
import { Sidebar } from '@/components/sidebar';

export default async function CatalogueLayout({ children }: { children: React.ReactNode }) {
  const settings = (await prisma.siteSettings.findUnique({ where: { id: 1 } })) ?? { brandName: '', monogram: '' };
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
