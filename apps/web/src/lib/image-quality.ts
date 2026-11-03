export interface Raster {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

export interface QualityThresholds {
  minShortSide: number;
  minLaplacianVariance: number;
  minBrightness: number;
  maxBrightness: number;
  maxGlareRatio: number;
  minFillRatio: number;
}

export const DEFAULT_QUALITY: QualityThresholds = {
  minShortSide: 480,
  minLaplacianVariance: 40,
  minBrightness: 35,
  maxBrightness: 225,
  maxGlareRatio: 0.08,
  minFillRatio: 0.4,
};

export type QualityIssue = 'resolution' | 'blur' | 'dark' | 'bright' | 'glare' | 'fill';

export interface QualityReport {
  ok: boolean;
  issues: QualityIssue[];
  width: number;
  height: number;
  laplacianVariance: number;
  brightness: number;
  glareRatio: number;
  fillRatio: number;
}

export function assessRaster(
  raster: Raster,
  thresholds: QualityThresholds = DEFAULT_QUALITY,
): QualityReport {
  const { width, height, rgba } = raster;
  const issues: QualityIssue[] = [];
  if (Math.min(width, height) < thresholds.minShortSide) issues.push('resolution');

  const gray = new Float64Array(width * height);
  let brightnessSum = 0;
  let glare = 0;
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4;
    const value =
      0.299 * (rgba[offset] ?? 0) +
      0.587 * (rgba[offset + 1] ?? 0) +
      0.114 * (rgba[offset + 2] ?? 0);
    gray[index] = value;
    brightnessSum += value;
    if (value >= 245) glare += 1;
  }
  const brightness = gray.length === 0 ? 0 : brightnessSum / gray.length;
  const glareRatio = gray.length === 0 ? 0 : glare / gray.length;
  const laplacianVariance = varianceOfLaplacian(gray, width, height);
  const fillRatio = frameFillRatio(gray, width, height);

  if (laplacianVariance < thresholds.minLaplacianVariance) issues.push('blur');
  if (brightness < thresholds.minBrightness) issues.push('dark');
  if (brightness > thresholds.maxBrightness) issues.push('bright');
  if (glareRatio > thresholds.maxGlareRatio) issues.push('glare');
  if (fillRatio < thresholds.minFillRatio) issues.push('fill');

  return {
    ok: issues.length === 0,
    issues,
    width,
    height,
    laplacianVariance,
    brightness,
    glareRatio,
    fillRatio,
  };
}

export function varianceOfLaplacian(gray: Float64Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const center = gray[y * width + x] ?? 0;
      const lap =
        center * 4 -
        (gray[(y - 1) * width + x] ?? 0) -
        (gray[(y + 1) * width + x] ?? 0) -
        (gray[y * width + (x - 1)] ?? 0) -
        (gray[y * width + (x + 1)] ?? 0);
      sum += lap;
      sumSquares += lap * lap;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSquares / count - mean * mean;
}

/** Share of the centre guide whose pixels differ from the border. */
export function frameFillRatio(gray: Float64Array, width: number, height: number): number {
  if (width < 8 || height < 8) return 0;
  const x0 = Math.floor(width * 0.12);
  const y0 = Math.floor(height * 0.12);
  const x1 = Math.ceil(width * 0.88);
  const y1 = Math.ceil(height * 0.88);
  const border: number[] = [];
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (x < x0 || x >= x1 || y < y0 || y >= y1) {
        border.push(gray[y * width + x] ?? 0);
      }
    }
  }
  const baseline = median(border);
  let filled = 0;
  let inner = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      inner += 1;
      if (Math.abs((gray[y * width + x] ?? 0) - baseline) >= 28) filled += 1;
    }
  }
  return inner === 0 ? 0 : filled / inner;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : (sorted[mid] ?? 0);
}

export function qualityIssueCopy(issue: QualityIssue): string {
  switch (issue) {
    case 'resolution':
      return 'The photo is too small. Move closer and try again.';
    case 'blur':
      return 'The photo looks blurry. Hold steady and retake it.';
    case 'dark':
      return 'The photo is too dark.';
    case 'bright':
      return 'The photo is too bright.';
    case 'glare':
      return 'There is too much glare. Tilt the document slightly.';
    case 'fill':
      return 'Fit the whole document inside the frame.';
    default: {
      const unreachable: never = issue;
      return unreachable;
    }
  }
}
