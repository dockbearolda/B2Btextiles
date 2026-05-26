'use server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/slug';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

async function uniqueGenreSlug(base: string): Promise<string> {
  let slug = base, n = 1;
  while (await prisma.genre.findUnique({ where: { slug } })) { n += 1; slug = `${base}-${n}`; }
  return slug;
}

export async function createGenre(name: string) {
  await requireAdmin();
  const clean = z.string().min(1).max(120).parse(name.trim());
  const slug = await uniqueGenreSlug(slugify(clean));
  const agg = await prisma.genre.aggregate({ _max: { position: true } });
  const genre = await prisma.genre.create({
    data: { name: clean, slug, position: (agg._max.position ?? -1) + 1 },
  });
  revalidatePath('/', 'layout');
  return { id: genre.id, slug: genre.slug };
}

export async function deleteGenre(id: string) {
  await requireAdmin();
  const count = await prisma.product.count({ where: { genreId: id, deletedAt: null } });
  if (count > 0) throw new Error('Cette famille contient des produits.');
  await prisma.genre.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return { ok: true };
}
