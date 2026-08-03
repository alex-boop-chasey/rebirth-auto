/**
 * Plain text → Portable Text conversion.
 *
 * Minimal, deliberate: splits on blank lines (a double newline) into paragraphs,
 * and turns each paragraph into a single normal-style block with one span.
 * Nothing fancier — no marks, headings, or lists. Every block and span carries a
 * `_key` because Sanity requires keys on array items, including when this result
 * is patched into a document's `description` field.
 */
import type { PortableTextBlock } from '@portabletext/types';

export function plainTextToPortableText(input: string): PortableTextBlock[] {
  return input
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((paragraph) => ({
      _type: 'block',
      _key: crypto.randomUUID(),
      style: 'normal',
      markDefs: [],
      children: [{ _type: 'span', _key: crypto.randomUUID(), text: paragraph, marks: [] }],
    }));
}

/**
 * Portable Text → plain text. The inverse-ish of the above: each top-level block
 * becomes one line (its span texts concatenated), blocks joined by blank lines.
 * Non-text/void blocks (images, embeds) contribute nothing. Used server-side to
 * feed the current description into the "tighten" rewrite — never to render.
 */
export function portableTextToPlainText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((block) => {
      const b = block as { _type?: string; children?: unknown };
      if (b?._type !== 'block' || !Array.isArray(b.children)) return '';
      return b.children
        .map((child) => {
          const c = child as { _type?: string; text?: unknown };
          return c?._type === 'span' && typeof c.text === 'string' ? c.text : '';
        })
        .join('');
    })
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n\n');
}
