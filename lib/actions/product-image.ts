'use server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { getStorage } from '@/lib/storage';
import { thumbKey } from '@/lib/images/keys';
import { revalidatePath } from 'next/cache';

function keyFromUrl(url: string): string {
  return url.replace(/^\/uploads\//, '');
}

export async function deleteProductImage(id: string) {
  await requireAdmin();
  const img = await prisma.productImage.findUnique({ where: { id } });
  if (!img) return { ok: true };
  const storage = getStorage();
  const key = keyFromUrl(img.url);
  await storage.delete(key);
  await storage.delete(thumbKey(key));
  await prisma.productImage.delete({ where: { id } });
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function setPrimaryImage(id: string) {
  await requireAdmin();
  const img = await prisma.productImage.findUnique({ where: { id } });
  if (!img) throw new Error('Image introuvable');
  const others = await prisma.productImage.findMany({
    where: { productId: img.productId, id: { not: id } },
    orderBy: { position: 'asc' },
  });
  await prisma.$transaction([
    prisma.productImage.update({ where: { id }, data: { position: 0 } }),
    ...others.map((o, i) => prisma.productImage.update({ where: { id: o.id }, data: { position: i + 1 } })),
  ]);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function moveProductImage(id: string, dir: 'up' | 'down') {
  await requireAdmin();
  const img = await prisma.productImage.findUnique({ where: { id } });
  if (!img) throw new Error('Image introuvable');
  const neighbor = await prisma.productImage.findFirst({
    where: {
      productId: img.productId,
      position: dir === 'up' ? { lt: img.position } : { gt: img.position },
    },
    orderBy: { position: dir === 'up' ? 'desc' : 'asc' },
  });
  if (!neighbor) return { ok: true };
  await prisma.$transaction([
    prisma.productImage.update({ where: { id: img.id }, data: { position: neighbor.position } }),
    prisma.productImage.update({ where: { id: neighbor.id }, data: { position: img.position } }),
  ]);
  revalidatePath('/', 'layout');
  return { ok: true };
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export async function setImageFraming(id: string, framing: { offsetX: number; offsetY: number; scale: number }) {
  await requireAdmin();
  await prisma.productImage.update({
    where: { id },
    data: {
      offsetX: clamp(framing.offsetX, -100, 100),
      offsetY: clamp(framing.offsetY, -100, 100),
      scale: clamp(framing.scale, 1, 4),
    },
  });
  revalidatePath('/', 'layout');
  return { ok: true };
}
