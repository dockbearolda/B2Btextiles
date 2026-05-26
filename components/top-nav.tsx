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
