import { existsSync, mkdirSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';

/** مجلد تخزين الملفات المرفوعة (صور المنتجات). في الإنتاج يُفضّل تخزين سحابي (S3). */
export const UPLOADS_DIR = join(process.cwd(), 'storage', 'uploads');

/** الحد الأقصى لحجم الملف المرفوع: 5 ميغابايت. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * أنواع الصور المسموح بها فقط (صور نقطية — لا SVG/HTML لتفادي XSS المخزّن).
 * الامتداد يُشتقّ من النوع المُتحقَّق منه، لا من اسم الملف الأصلي.
 */
export const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

export function isAllowedImageMime(mime: string): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_MIME, mime);
}

export function extensionForMime(mime: string): string {
  return ALLOWED_IMAGE_MIME[mime] ?? '';
}

export function ensureUploadsDir(): void {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

/**
 * يتحقق من البصمة الثنائية (magic bytes) للملف على القرص، لا من ترويسة Content-Type
 * التي يتحكّم بها العميل. يُعيد النوع المكتشف أو null.
 */
export function sniffImageType(path: string): keyof typeof SIGNATURES | null {
  const header = Buffer.alloc(16);
  let fd: number | null = null;
  try {
    fd = openSync(path, 'r');
    readSync(fd, header, 0, 16, 0);
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      closeSync(fd);
    }
  }

  if (header.slice(0, 8).equals(SIGNATURES.png)) return 'png';
  if (header.slice(0, 3).equals(SIGNATURES.jpg)) return 'jpg';
  if (header.slice(0, 4).equals(SIGNATURES.gif)) return 'gif';
  // WEBP: "RIFF"????"WEBP"
  if (header.slice(0, 4).equals(SIGNATURES.riff) && header.slice(8, 12).equals(SIGNATURES.webp)) {
    return 'webp';
  }
  return null;
}

const SIGNATURES = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: Buffer.from([0xff, 0xd8, 0xff]),
  gif: Buffer.from([0x47, 0x49, 0x46, 0x38]), // GIF8
  riff: Buffer.from('RIFF'),
  webp: Buffer.from('WEBP'),
};
