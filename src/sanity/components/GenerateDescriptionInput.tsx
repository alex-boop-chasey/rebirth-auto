/**
 * Custom Studio INPUT component for the listing `description` (Portable Text)
 * field. Renders a "Generate description" button ABOVE the default editor.
 *
 * On click it POSTs the current document id to /api/generate-description (same
 * origin as the embedded Studio — the endpoint's origin allowlist already covers
 * the Studio origins), receives Portable Text back, and writes it into the field
 * via `onChange(set(...))`. All AI/config lives server-side in the endpoint; this
 * component is a thin trigger. Replaces the old document-action trigger so the
 * button lives on the form, right under the dealer notes it draws from.
 */
import { useCallback, useState } from 'react';
import { set, useFormValue, type PortableTextInputProps } from 'sanity';
import { Button, Stack, useToast } from '@sanity/ui';
import type { PortableTextBlock } from '@portabletext/types';

export function GenerateDescriptionInput(props: PortableTextInputProps) {
  const { onChange } = props;
  const id = useFormValue(['_id']) as string | undefined;
  const toast = useToast();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    // A brand-new, never-saved doc has no id yet — nothing to fetch server-side.
    if (!id) {
      toast.push({
        status: 'warning',
        title: 'Generate description',
        description: 'Save the listing first, then generate a description.',
      });
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id }),
      });
      const data = (await res.json().catch(() => null)) as
        | { description?: unknown; error?: string }
        | null;

      if (!res.ok || !data || !Array.isArray(data.description)) {
        toast.push({
          status: 'error',
          title: 'Generate description',
          description: data?.error ?? `Request failed (${res.status}).`,
        });
        return;
      }

      // Overwrite the field value; the draft stays unpublished for review.
      onChange(set(data.description as PortableTextBlock[]));
      toast.push({
        status: 'success',
        title: 'Description generated',
        description: 'Review it and publish when you’re happy.',
      });
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Generate description',
        description: err instanceof Error ? err.message : 'Network error.',
      });
    } finally {
      setGenerating(false);
    }
  }, [id, onChange, toast]);

  return (
    <Stack space={3}>
      <Button
        mode="ghost"
        tone="primary"
        text={generating ? 'Generating…' : 'Generate description'}
        disabled={generating}
        loading={generating}
        onClick={handleGenerate}
      />
      {props.renderDefault(props)}
    </Stack>
  );
}
