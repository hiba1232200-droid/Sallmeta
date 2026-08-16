/**
 * يحوّل نصًا (عربي أو لاتيني) إلى slug آمن. يحافظ على الحروف العربية والأرقام.
 */
export function slugify(input: string): string {
  const base = (input || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base || 'item';
}

/** يضيف لاحقة عشوائية قصيرة لضمان التفرّد. */
export function slugifyUnique(input: string, suffixLength = 6): string {
  const suffix = Math.random()
    .toString(36)
    .slice(2, 2 + suffixLength);
  return `${slugify(input)}-${suffix}`;
}
