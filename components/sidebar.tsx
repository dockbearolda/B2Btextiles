'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NewEntityCard } from './new-entity-card';
import { createGenre } from '@/lib/actions/genre';

type GenreLink = { id: string; slug: string; name: string; count: number };

export function Sidebar({ genres }: { genres: GenreLink[] }) {
  const pathname = usePathname();
  return (
    <nav style={{ display: 'grid', gap: 4 }}>
      <Link href="/catalogue" style={rowStyle(pathname === '/catalogue')}>Tous les produits</Link>
      {genres.map((g) => {
        const base = `/catalogue/${g.slug}`;
        const active = pathname === base || pathname.startsWith(`${base}/`);
        return (
          <Link key={g.id} href={base} style={rowStyle(active)}>
            <span>{g.name}</span>
            <span className="micro-label" style={{ marginLeft: 'auto' }}>{g.count}</span>
          </Link>
        );
      })}
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
