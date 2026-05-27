import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processImage } from './process';

async function redPng(w: number, h: number) {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 0, b: 0 } } })
    .png()
    .toBuffer();
}

describe('processImage', () => {
  it('produit full+thumb WebP avec dimensions plafonnées', async () => {
    const input = await redPng(2400, 1800);
    const out = await processImage(input);
    expect((await sharp(out.full).metadata()).format).toBe('webp');
    expect((await sharp(out.thumb).metadata()).format).toBe('webp');
    expect(out.width).toBeLessThanOrEqual(1600);
    expect((await sharp(out.thumb).metadata()).width!).toBeLessThanOrEqual(500);
  });
  it('rejette un buffer non-image', async () => {
    await expect(processImage(Buffer.from('pas une image'))).rejects.toThrow();
  });
});
