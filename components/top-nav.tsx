import { EditableText } from './editable-text';
import { BrandLink } from './brand-link';

export function TopNav({ brandName, monogram }: { brandName: string; monogram: string }) {
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
      borderBottom: '1px solid var(--brand-sage)', background: '#ffffffaa', backdropFilter: 'blur(6px)',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <BrandLink>
        <span style={{
          width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 'var(--r-3)',
          background: 'var(--brand-duck)', color: '#fff', fontWeight: 600, fontSize: 13,
        }}>
          <EditableText entity="site" entityId="1" field="monogram" value={monogram} placeholder="AB" />
        </span>
        <strong style={{ fontSize: 16 }}>
          <EditableText entity="site" entityId="1" field="brandName" value={brandName} placeholder="Nom de la maison" />
        </strong>
      </BrandLink>
    </header>
  );
}
