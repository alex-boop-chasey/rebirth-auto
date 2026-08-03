/**
 * Custom Studio INPUT component for the listing `description` (Portable Text)
 * field. Renders a small EDITOR ASSISTANT toolbar ABOVE the default editor — a
 * distinct "brain" from the visitor-facing Rebi, offering a few one-shot actions
 * over the OPEN listing:
 *   - Generate description  → drafts a fresh description (the original behaviour).
 *   - Tighten               → rewrites the current description tighter, same facts.
 *   - Adjust tone           → regenerates the description in a chosen tone.
 *   - Selling points        → drafts 3–5 scannable bullet points.
 *
 * Every action POSTs the current document id (plus an `action`, and for tone a
 * `tone`) to /api/generate-description (same origin as the embedded Studio — the
 * endpoint's origin allowlist already covers the Studio origins). The endpoint
 * reads the listing server-side and does all AI/config work; this component is a
 * thin trigger. The three description actions write Portable Text into the field
 * via `onChange(set(...))`. Selling points are NON-description output: they are
 * shown in a panel to copy, with an explicit "Append to description" affordance
 * (least-surprising — nothing is auto-written over the editor's prose).
 *
 * The tone vocabulary comes from config (DESCRIPTION_TONES) — no tone is
 * hardcoded here; the default selection is the dealer's configured voice.
 */
import { useCallback, useState } from 'react';
import { set, useDocumentOperation, useFormValue, type PortableTextInputProps } from 'sanity';
import { Button, Card, Flex, Select, Stack, Text, useToast } from '@sanity/ui';
import type { PortableTextBlock } from '@portabletext/types';
import { DESCRIPTION_TONES, dealerConfig, type DescriptionTone } from '../../config/dealer';

type AssistAction = 'describe' | 'sellingPoints' | 'tighten' | 'tone';

// Human label for a tone code — derived, never a hardcoded tone list.
function toneLabel(tone: string): string {
  return tone
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Turn selling-point lines into `bullet` Portable Text blocks for appending.
function sellingPointsToBlocks(points: string[]): PortableTextBlock[] {
  return points.map((text) => ({
    _type: 'block',
    _key: crypto.randomUUID(),
    style: 'normal',
    listItem: 'bullet',
    level: 1,
    markDefs: [],
    children: [{ _type: 'span', _key: crypto.randomUUID(), text, marks: [] }],
  }));
}

/** The AI-derived attributes the 'describe' action may return alongside the copy. */
interface AiAttributes {
  runningCost?: string;
  usageFit?: string[];
  sizeClass?: string;
}

export function GenerateDescriptionInput(props: PortableTextInputProps) {
  const { onChange, value } = props;
  const id = useFormValue(['_id']) as string | undefined;
  const type = (useFormValue(['_type']) as string | undefined) ?? 'listing';
  const toast = useToast();

  // Document-level patch channel for `aiAttributes` — a DIFFERENT field than this
  // PT input's own `description`, so `onChange(set(...))` can't reach it. The
  // operation targets the DRAFT by design (operations always act on the editable
  // draft). Keyed by the PUBLISHED id per the Studio API. `id` is present before
  // any action runs (run() early-returns without one), so '' is a never-used
  // placeholder that only satisfies the hooks-must-be-unconditional rule.
  const publishedId = (id ?? '').replace(/^drafts\./, '');
  const { patch } = useDocumentOperation(publishedId, type);
  // Which action is currently running (drives per-action loading/disabled state).
  const [busy, setBusy] = useState<AssistAction | null>(null);
  const [tone, setTone] = useState<DescriptionTone>(dealerConfig.ai.descriptionVoice.tone);
  const [sellingPoints, setSellingPoints] = useState<string[] | null>(null);

  const currentValue = (value as PortableTextBlock[] | undefined) ?? [];

  const run = useCallback(
    async (action: AssistAction, extra?: Record<string, unknown>) => {
      // A brand-new, never-saved doc has no id yet — nothing to fetch server-side.
      if (!id) {
        toast.push({
          status: 'warning',
          title: 'Rebi assistant',
          description: 'Save the listing first, then try again.',
        });
        return;
      }

      setBusy(action);
      try {
        const res = await fetch('/api/generate-description', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: id, action, ...extra }),
        });
        const data = (await res.json().catch(() => null)) as
          | {
              description?: unknown;
              sellingPoints?: unknown;
              aiAttributes?: AiAttributes;
              enrichError?: boolean;
              error?: string;
            }
          | null;

        if (!res.ok || !data || data.error) {
          toast.push({
            status: 'error',
            title: 'Rebi assistant',
            description: data?.error ?? `Request failed (${res.status}).`,
          });
          return;
        }

        if (action === 'sellingPoints') {
          if (!Array.isArray(data.sellingPoints) || data.sellingPoints.length === 0) {
            toast.push({
              status: 'error',
              title: 'Selling points',
              description: 'No selling points came back — please try again.',
            });
            return;
          }
          setSellingPoints(data.sellingPoints as string[]);
          toast.push({
            status: 'success',
            title: 'Selling points drafted',
            description: 'Copy them, or append them to the description below.',
          });
          return;
        }

        // describe / tighten / tone all return Portable Text for the field.
        if (!Array.isArray(data.description)) {
          toast.push({
            status: 'error',
            title: 'Rebi assistant',
            description: 'Unexpected response — please try again.',
          });
          return;
        }
        onChange(set(data.description as PortableTextBlock[]));

        // 'describe' also enriches `aiAttributes`. This is a DOCUMENT-level patch
        // (a different field than `description`), so it goes through the document
        // operation's patch channel, not `onChange`. Partial success MUST be
        // visible: if attributes are absent or `enrichError` is set, we still set
        // the description but warn the dealer they can fill the attributes in.
        if (action === 'describe') {
          const attrs = data.aiAttributes;
          const hasAttrs = !!attrs && Object.keys(attrs).length > 0;
          if (hasAttrs && !data.enrichError) {
            try {
              patch.execute([{ set: { aiAttributes: attrs } }]);
              const fits = attrs.usageFit?.length ? ` · fits: ${attrs.usageFit.join(', ')}` : '';
              toast.push({
                status: 'success',
                title: 'Description + AI attributes updated',
                description: `AI attributes were set${fits}. Review and publish when you’re happy.`,
              });
            } catch (patchErr) {
              console.error('[GenerateDescriptionInput] aiAttributes patch failed', patchErr);
              toast.push({
                status: 'warning',
                title: 'Description updated — attributes not saved',
                description: 'The AI attributes could not be applied automatically; set them manually below.',
              });
            }
          } else {
            toast.push({
              status: 'warning',
              title: 'Description updated — AI attributes left unset',
              description: 'The AI could not confidently derive the attributes; fill them in manually below.',
            });
          }
          return;
        }

        toast.push({
          status: 'success',
          title: 'Description updated',
          description: 'Review it and publish when you’re happy.',
        });
      } catch (err) {
        toast.push({
          status: 'error',
          title: 'Rebi assistant',
          description: err instanceof Error ? err.message : 'Network error.',
        });
      } finally {
        setBusy(null);
      }
    },
    [id, onChange, toast, patch],
  );

  const appendSellingPoints = useCallback(() => {
    if (!sellingPoints?.length) return;
    onChange(set([...currentValue, ...sellingPointsToBlocks(sellingPoints)]));
    toast.push({
      status: 'success',
      title: 'Selling points appended',
      description: 'Added as bullet points at the end of the description.',
    });
  }, [sellingPoints, currentValue, onChange, toast]);

  const copySellingPoints = useCallback(() => {
    if (!sellingPoints?.length) return;
    const text = sellingPoints.map((p) => `• ${p}`).join('\n');
    void navigator.clipboard?.writeText(text).then(
      () => toast.push({ status: 'success', title: 'Copied', description: 'Selling points copied.' }),
      () => toast.push({ status: 'error', title: 'Copy failed', description: 'Copy them manually.' }),
    );
  }, [sellingPoints, toast]);

  const anyBusy = busy !== null;

  return (
    <Stack space={3}>
      <Flex gap={2} wrap="wrap" align="center">
        <Button
          mode="ghost"
          tone="primary"
          text={busy === 'describe' ? 'Generating…' : 'Generate description'}
          disabled={anyBusy}
          loading={busy === 'describe'}
          onClick={() => run('describe')}
        />
        <Button
          mode="ghost"
          text={busy === 'tighten' ? 'Tightening…' : 'Tighten'}
          disabled={anyBusy}
          loading={busy === 'tighten'}
          onClick={() => run('tighten')}
        />
        <Button
          mode="ghost"
          text={busy === 'sellingPoints' ? 'Drafting…' : 'Selling points'}
          disabled={anyBusy}
          loading={busy === 'sellingPoints'}
          onClick={() => run('sellingPoints')}
        />
      </Flex>

      <Flex gap={2} wrap="wrap" align="center">
        <Select
          value={tone}
          disabled={anyBusy}
          onChange={(e) => setTone(e.currentTarget.value as DescriptionTone)}
        >
          {DESCRIPTION_TONES.map((t) => (
            <option key={t} value={t}>
              {toneLabel(t)}
            </option>
          ))}
        </Select>
        <Button
          mode="ghost"
          text={busy === 'tone' ? 'Rewriting…' : 'Rewrite in this tone'}
          disabled={anyBusy}
          loading={busy === 'tone'}
          onClick={() => run('tone', { tone })}
        />
      </Flex>

      {sellingPoints && sellingPoints.length > 0 && (
        <Card padding={3} radius={2} shadow={1} tone="primary">
          <Flex direction="column" gap={3}>
            <Text size={1} weight="semibold">
              Suggested selling points
            </Text>
            <Flex direction="column" gap={2} as="ul">
              {sellingPoints.map((point, i) => (
                <Text key={i} size={1} as="li">
                  • {point}
                </Text>
              ))}
            </Flex>
            <Flex gap={2} wrap="wrap">
              <Button mode="ghost" text="Append to description" onClick={appendSellingPoints} disabled={anyBusy} />
              <Button mode="bleed" text="Copy" onClick={copySellingPoints} />
              <Button mode="bleed" text="Dismiss" onClick={() => setSellingPoints(null)} />
            </Flex>
          </Flex>
        </Card>
      )}

      {props.renderDefault(props)}
    </Stack>
  );
}
