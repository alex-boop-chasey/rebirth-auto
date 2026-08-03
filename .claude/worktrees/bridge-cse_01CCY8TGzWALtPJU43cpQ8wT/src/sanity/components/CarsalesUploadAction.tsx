/**
 * Custom Studio DOCUMENT ACTION for the `listing` type: "Upload to carsales".
 *
 * Appears in the listing document's action menu and, when clicked, POSTs the
 * document id to /api/carsales-upload (same origin as the embedded Studio — the
 * endpoint's origin allowlist already covers the Studio origins). It surfaces
 * the returned (stubbed) carsales URL via a toast. All syndication/config lives
 * server-side in the endpoint; this component is a thin trigger — mirroring the
 * GenerateDescriptionInput integration style.
 *
 * PUBLISHED ONLY: the action is DISABLED unless a published version exists
 * (`props.published`), so a draft-only listing can't be uploaded — and the
 * endpoint independently enforces published+active. Registration in
 * sanity.config.ts gates the whole action behind the config flag.
 *
 * NOTE: the icon is imported from the `@sanity/icons` SUBPATH — importing from
 * the package root type-checks but crashes the Studio at runtime under v5
 * (same footgun documented in ListingFormFooter.tsx).
 */
import { useCallback, useState } from 'react';
import { type DocumentActionComponent, type DocumentActionProps } from 'sanity';
import { useToast } from '@sanity/ui';
import { UploadIcon } from '@sanity/icons/Upload';

interface CarsalesUploadResponse {
  result?: { carsalesId?: string; url?: string; mode?: string; message?: string };
  error?: string;
}

export const CarsalesUploadAction: DocumentActionComponent = (props: DocumentActionProps) => {
  const { id, published } = props;
  // Read the completion callback through a narrow cast: it signals Studio the
  // action finished (closes/re-enables the menu item). Accessed this way to avoid
  // coupling to the prop's deprecated-symbol JSDoc while keeping correct behaviour.
  const onComplete = (props as { onComplete?: () => void }).onComplete;
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  // Published-only: nothing to syndicate until a published version exists.
  const isPublished = Boolean(published);

  const handle = useCallback(async () => {
    setUploading(true);
    try {
      const res = await fetch('/api/carsales-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId: id }),
      });
      const data = (await res.json().catch(() => null)) as CarsalesUploadResponse | null;

      if (!res.ok || !data || !data.result?.url) {
        toast.push({
          status: 'error',
          title: 'Upload to carsales',
          description: data?.error ?? `Request failed (${res.status}).`,
        });
        return;
      }

      toast.push({
        status: 'success',
        title:
          data.result.mode === 'stub'
            ? 'Uploaded to carsales (demo)'
            : 'Uploaded to carsales',
        description: `Listing URL: ${data.result.url}`,
        duration: 12000,
      });
    } catch (err) {
      toast.push({
        status: 'error',
        title: 'Upload to carsales',
        description: err instanceof Error ? err.message : 'Network error.',
      });
    } finally {
      setUploading(false);
      onComplete?.();
    }
  }, [id, onComplete, toast]);

  return {
    label: uploading ? 'Uploading…' : 'Upload to carsales',
    icon: UploadIcon,
    disabled: !isPublished || uploading,
    title: isPublished
      ? 'Syndicate this published listing to carsales.com.au'
      : 'Publish the listing before uploading to carsales.',
    onHandle: handle,
  };
};
