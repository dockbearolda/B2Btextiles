'use server';
import { requireAdmin } from '@/lib/auth-guard';
import { validateFieldUpdate } from '@/lib/mutations/field-schemas';
import { models } from '@/lib/mutations/models';
import { revalidatePath } from 'next/cache';

export async function updateField(entity: string, id: string, field: string, raw: unknown) {
  await requireAdmin();
  const model = models[entity];
  if (!model) throw new Error(`Entité inconnue : ${entity}`);
  const value = validateFieldUpdate(entity, field, raw);
  await model.update(id, { [field]: value });
  revalidatePath(model.revalidate, 'layout');
  return { ok: true };
}
