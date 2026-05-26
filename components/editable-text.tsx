'use client';
import { useState } from 'react';
import { useEditMode } from './edit-mode-provider';
import { updateField } from '@/lib/actions/update-field';
import { toast } from 'sonner';

type Common = { entity: string; entityId: string; field: string; placeholder?: string; className?: string };

export function EditableText({
  entity, entityId, field, value, placeholder = '—', multiline = false, className,
}: Common & { value: string | null; multiline?: boolean }) {
  const { editing } = useEditMode();
  const [val, setVal] = useState(value ?? '');
  if (!editing) return <span className={className}>{value || placeholder}</span>;

  async function commit() {
    if (val === (value ?? '')) return;
    try {
      await updateField(entity, entityId, field, val);
      toast.success('Enregistré');
    } catch {
      toast.error("Échec de l'enregistrement");
      setVal(value ?? '');
    }
  }
  const common = {
    value: val,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setVal(e.target.value),
    onBlur: commit,
    placeholder,
    className,
    style: { border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-2)', padding: '2px 6px', background: 'transparent', font: 'inherit', color: 'inherit', width: '100%' as const },
  };
  return multiline
    ? <textarea {...common} rows={3} />
    : <input {...common} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}

export function EditableNumber({
  entity, entityId, field, value, unit = '', placeholder = '0', className,
}: Common & { value: number | null; unit?: string }) {
  const { editing } = useEditMode();
  const [val, setVal] = useState(value != null ? String(value) : '');
  if (!editing) return <span className={className}>{value != null ? `${value}${unit ? ' ' + unit : ''}` : placeholder}</span>;

  async function commit() {
    try {
      await updateField(entity, entityId, field, val);
      toast.success('Enregistré');
    } catch {
      toast.error('Valeur invalide');
      setVal(value != null ? String(value) : '');
    }
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input inputMode="decimal" value={val}
        onChange={(e) => setVal(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder={placeholder} className={className}
        style={{ border: '1px dashed var(--brand-duck-300)', borderRadius: 'var(--r-2)', padding: '2px 6px', width: 90, font: 'inherit', color: 'inherit', background: 'transparent' }} />
      {unit && <span>{unit}</span>}
    </span>
  );
}
