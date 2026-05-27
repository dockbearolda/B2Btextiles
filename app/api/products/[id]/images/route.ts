import { NextRequest, NextResponse } from 'next/server';
import { getIsAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { processImage } from '@/lib/images/process';
import { newImageKey, thumbKey, publicUrl } from '@/lib/images/keys';
import { getStorage } from '@/lib/storage';
import { revalidatePath } from 'next/cache';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getIsAdmin())) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 });

  const storage = getStorage();
  const agg = await prisma.productImage.aggregate({ where: { productId: id }, _max: { position: true } });
  let position = (agg._max.position ?? -1) + 1;
  let created = 0;

  for (const file of files) {
    if (file.size > MAX_BYTES)
      return NextResponse.json({ error: `Fichier trop volumineux (max 8 Mo) : ${file.name}` }, { status: 413 });
    let processed;
    try {
      processed = await processImage(Buffer.from(await file.arrayBuffer()));
    } catch {
      return NextResponse.json({ error: `Fichier non valide : ${file.name}` }, { status: 415 });
    }
    const key = newImageKey();
    await storage.save(key, processed.full);
    await storage.save(thumbKey(key), processed.thumb);
    await prisma.productImage.create({
      data: { productId: id, url: publicUrl(key), width: processed.width, height: processed.height, position: position++ },
    });
    created++;
  }
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true, created });
}
