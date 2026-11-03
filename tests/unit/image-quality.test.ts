import { assessRaster, type Raster } from '../../apps/web/src/lib/image-quality.ts';
import { describe, expect, it } from 'vitest';

const thresholds = {
  minShortSide: 32,
  minLaplacianVariance: 30,
  minBrightness: 40,
  maxBrightness: 220,
  maxGlareRatio: 0.05,
  minFillRatio: 0.45,
};

function raster(width: number, height: number, paint: (x: number, y: number) => number): Raster {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = paint(x, y);
      const offset = (y * width + x) * 4;
      rgba[offset] = value;
      rgba[offset + 1] = value;
      rgba[offset + 2] = value;
      rgba[offset + 3] = 255;
    }
  }
  return { width, height, rgba };
}

describe('document image quality', () => {
  it('accepts a sharp document that fills the frame', () => {
    const image = raster(80, 80, (x, y) => {
      const inside = x > 8 && x < 72 && y > 8 && y < 72;
      if (!inside) return 20;
      return (x + y) % 2 === 0 ? 30 : 200;
    });
    const report = assessRaster(image, thresholds);
    expect(report.issues).not.toContain('blur');
    expect(report.issues).not.toContain('fill');
    expect(report.ok).toBe(true);
  });

  it('rejects a blurry, dark, or undersized capture', () => {
    const blurry = assessRaster(
      raster(80, 80, () => 128),
      thresholds,
    );
    expect(blurry.issues).toContain('blur');
    const dark = assessRaster(
      raster(80, 80, (x, y) => ((x + y) % 2 === 0 ? 0 : 10)),
      thresholds,
    );
    expect(dark.issues).toContain('dark');
    const small = assessRaster(
      raster(16, 16, (x, y) => ((x + y) % 2 === 0 ? 20 : 220)),
      thresholds,
    );
    expect(small.issues).toContain('resolution');
  });

  it('rejects glare', () => {
    const bright = assessRaster(
      raster(80, 80, () => 250),
      thresholds,
    );
    expect(bright.issues).toContain('glare');
  });
});
