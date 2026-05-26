import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess((v) => (v === '' ? null : v), z.string().max(max).nullable());

export const fieldSchemas: Record<string, Record<string, z.ZodTypeAny>> = {
  site: {
    brandName: z.string().max(120),
    monogram: z.string().max(12),
    quoteEmail: z.union([z.string().email(), z.literal('')]),
  },
  genre: {
    name: z.string().min(1).max(120),
    description: optionalText(2000),
  },
  product: {
    designation: z.string().min(1).max(200),
    description: optionalText(5000),
    prix: z.coerce.number().min(0).max(999999),
    refInterne: optionalText(80),
    refFournisseur: optionalText(80),
    genreId: z.string().min(1),
    fabricColorId: z.union([z.string().min(1), z.literal(''), z.null()]).transform((v) => (v ? v : null)),
  },
};

export function validateFieldUpdate(entity: string, field: string, raw: unknown): unknown {
  const entityFields = fieldSchemas[entity];
  if (!entityFields) throw new Error(`Entité non éditable : ${entity}`);
  const schema = entityFields[field];
  if (!schema) throw new Error(`Champ non éditable : ${entity}.${field}`);
  return schema.parse(raw);
}
