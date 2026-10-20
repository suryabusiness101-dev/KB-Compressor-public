export type OutputMime = "image/jpeg" | "image/png" | "image/webp";

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  quality: number | null;
  scale: number;
  originalSize: number;
  finalSize: number;
  ratio: number;
  hitTarget: boolean;
  alreadyUnderTarget: boolean;
}

const QUALITY_TUNABLE_MIMES: OutputMime[] = ["image/jpeg", "image/webp"];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image file."));
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed."))),
      mime,
      quality,
    );
  });
}

function drawAtScale(img: HTMLImageElement, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Binary-searches JPEG/WebP quality at a given scale for the highest
 * quality that still lands at or under targetBytes. Returns null if even
 * quality 0 at this scale can't hit the target (caller should downscale).
 */
async function bestQualityAtScale(
  canvas: HTMLCanvasElement,
  mime: string,
  targetBytes: number,
): Promise<{ blob: Blob; quality: number } | null> {
  let lo = 0;
  let hi = 1;
  let best: { blob: Blob; quality: number } | null = null;

  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, mime, mid);
    if (blob.size <= targetBytes) {
      best = { blob, quality: mid };
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return best;
}

/**
 * Compresses an image to as close to (at or under) targetKB as possible.
 * Strategy: for JPEG/WebP, binary-search the quality parameter at full
 * scale first; only downscale dimensions if quality 0 still overshoots
 * the target. PNG has no lossy quality lever in the canvas API, so it
 * relies on downscaling alone.
 */
export async function compressToTargetKB(
  file: File,
  targetKB: number,
  outputMime: OutputMime,
): Promise<CompressResult> {
  const targetBytes = Math.max(1, Math.floor(targetKB * 1024));

  // Re-encoding an image that's already under the target (in the same
  // format) can only make it worse: JPEG/WebP re-compression from decoded
  // pixels frequently comes out *larger* than a source that was already
  // efficiently compressed, even at high quality settings. Skip the round
  // trip and hand back the original bytes untouched.
  if (file.type === outputMime && file.size <= targetBytes) {
    const dims = await loadImage(file);
    const width = dims.naturalWidth;
    const height = dims.naturalHeight;
    URL.revokeObjectURL(dims.src);
    return {
      blob: file,
      width,
      height,
      quality: null,
      scale: 1,
      originalSize: file.size,
      finalSize: file.size,
      ratio: 1,
      hitTarget: true,
      alreadyUnderTarget: true,
    };
  }

  const img = await loadImage(file);
  const supportsQuality = QUALITY_TUNABLE_MIMES.includes(outputMime);

  let scale = 1;
  let result: { blob: Blob; quality: number | null; scale: number } | null = null;

  for (let attempt = 0; attempt < 14; attempt++) {
    const canvas = drawAtScale(img, scale);

    if (supportsQuality) {
      const found = await bestQualityAtScale(canvas, outputMime, targetBytes);
      if (found) {
        result = { blob: found.blob, quality: found.quality, scale };
        break;
      }
    } else {
      const blob = await canvasToBlob(canvas, outputMime);
      if (blob.size <= targetBytes) {
        result = { blob, quality: null, scale };
        break;
      }
    }

    if (canvas.width <= 24 || canvas.height <= 24) break;
    scale *= 0.85;
  }

  let hitTarget = true;
  if (!result) {
    hitTarget = false;
    const canvas = drawAtScale(img, scale);
    const blob = supportsQuality
      ? (await bestQualityAtScale(canvas, outputMime, Infinity))!.blob
      : await canvasToBlob(canvas, outputMime);
    result = { blob, quality: supportsQuality ? 0 : null, scale };
  }

  URL.revokeObjectURL(img.src);

  return {
    blob: result.blob,
    width: Math.max(1, Math.round(img.naturalWidth * result.scale)),
    height: Math.max(1, Math.round(img.naturalHeight * result.scale)),
    quality: result.quality,
    scale: result.scale,
    originalSize: file.size,
    finalSize: result.blob.size,
    ratio: file.size / result.blob.size,
    hitTarget,
    alreadyUnderTarget: false,
  };
}

export function formatKB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export const OUTPUT_EXTENSION: Record<OutputMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
