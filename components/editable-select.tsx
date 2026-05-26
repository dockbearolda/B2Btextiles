'use client';
import { useEditMode } from './edit-mode-provider';
import { updateField } from '@/lib/actions/update-field';
import { toast } from 'sonner';

type Option = { value: string; label: string };

export function EditableSelect({
  entity, entityId, field, value, options, className,
}: { entity: string; entityId: string; field: string; value: string | null; options: Option[]; className?: string }) {
  const { editing } = useEditMode();
  const current = options.find((o) => o.value === value);
  if (!editing) return <span className={className}>{current?.label ?? '—'}</span>;
  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    try { await updateField(entity, entityId, field, e.target.value); toast.success('Enregistré'); }
    catch { toast.error("Échec de l'enregistrement"); }
  }
  return (
    <select defaultValue={value ?? ''} onChange={onChange} className={className}
      style={{ font: 'inherit', padding: '4px 6px', border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-2)', background: 'transparent' }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
