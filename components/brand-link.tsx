'use client';
import Link from 'next/link';
import { useEditMode } from './edit-mode-provider';

// Home link in view mode. In edit mode it renders children bare, so the editable
// brand inputs are not nested inside an <a> (invalid HTML + the click would
// navigate home instead of focusing the field).
export function BrandLink({ children }: { children: React.ReactNode }) {
  const { editing } = useEditMode();
  const inner = { display: 'flex', alignItems: 'center', gap: 10 } as const;
  if (editing) return <span style={inner}>{children}</span>;
  return (
    <Link href="/catalogue" style={{ ...inner, textDecoration: 'none', color: 'var(--fg-1)' }}>
      {children}
    </Link>
  );
}
