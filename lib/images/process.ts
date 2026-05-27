import sharp from 'sharp';

const FULL_MAX = 1600;
const THUMB_MAX = 500;

export type ProcessedImage = { full: Buffer; thumb: Buffer; width: number; height: number };

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const meta = await sharp(input).metadata(); // throws si non-image
  if (!meta.width || !meta.height) throw new Error('Image invalide');

  const base = sharp(input).rotate(); // respecte l'orientation EXIF puis strip metadata
  const full = await base
    .clone()
    .resize({ width: FULL_MAX, height: FULL_MAX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const thumb = await base
    .clone()
    .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  const fullMeta = await sharp(full).metadata();
  return { full, thumb, width: fullMeta.width!, height: fullMeta.height! };
}
