import { prisma } from '@/lib/db';
import { TopNav } from '@/components/top-nav';

export default async function CatalogueLayout({ children }: { children: React.ReactNode }) {
  const settings = await prisma.siteSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return (
    <div style={{ minHeight: '100dvh' }}>
      <TopNav brandName={settings.brandName} monogram={settings.monogram} />
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', alignItems: 'start' }}>
        <aside style={{ padding: 16, borderRight: '1px solid var(--brand-sage)', minHeight: '60dvh' }} />
        <main style={{ padding: 20 }}>{children}</main>
      </div>
    </div>
  );
}
