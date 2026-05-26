'use server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slug';
import { revalidatePath } from 'next/cache';

async function uniqueProductSlug(base: string): Promise<string> {
  let slug = base, n = 1;
  while (await prisma.product.findUnique({ where: { slug } })) { n += 1; slug = `${base}-${n}`; }
  return slug;
}

export async function createProduct(genreId: string) {
  await requireAdmin();
  await prisma.genre.findUniqueOrThrow({ where: { id: genreId } });
  const slug = await uniqueProductSlug(slugify('nouveau-produit'));
  const agg = await prisma.product.aggregate({ where: { genreId }, _max: { position: true } });
  const p = await prisma.product.create({
    data: { genreId, slug, designation: 'Nouveau produit', prix: 0, published: true, position: (agg._max.position ?? -1) + 1 },
  });
  revalidatePath('/', 'layout');
  return { id: p.id, slug: p.slug };
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  await prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/', 'layout');
  return { ok: true };
}
