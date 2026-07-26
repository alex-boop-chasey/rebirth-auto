/**
 * Root-level document form component for the `listing` type.
 *
 * Sanity treats the *entire document form* as an object input whose `id` is
 * `'root'`. This component is registered via `form.components.input` in
 * sanity.config.ts (gated to the listing root) and renders the default form
 * (`props.renderDefault(props)`) followed by a sticky-feeling footer.
 *
 * Because Studio's field groups (tabs) filter the visible fields to the active
 * group only, a single footer rendered BELOW the default form visually sits at
 * the bottom of whichever tab is active. So one component yields a correct
 * per-tab footer without cluttering the schema with virtual "button" fields.
 *
 * Behaviour:
 *  - On every tab except the last (`media`), a "Next" button switches to the
 *    next tab via `props.onFieldGroupSelect(nextGroup.name)`.
 *  - On the final tab, a "Publish" button runs the same operation the built-in
 *    Publish document action does: `useDocumentOperation(id, type).publish`.
 *    It's disabled whenever the operation reports `disabled` (NO_CHANGES /
 *    NOT_READY / live-edit, etc.) OR validation has error-level markers — so it
 *    tracks the built-in Publish's gating as closely as practical from here.
 *
 * NOTE: icons are imported from their `@sanity/icons` SUBPATH — importing from
 * the package root type-checks but crashes the Studio at runtime under v5.
 */
import { useCallback } from 'react';
import {
  getPublishedId,
  useDocumentOperation,
  useValidationStatus,
  type ObjectInputProps,
} from 'sanity';
import { Box, Button, Card, Flex, useToast } from '@sanity/ui';
import { ArrowRightIcon } from '@sanity/icons/ArrowRight';
import { PublishIcon } from '@sanity/icons/Publish';

export function ListingFormFooter(props: ObjectInputProps) {
  const toast = useToast();

  // The root form node's `id` is the literal string 'root', NOT the document
  // id — read the id off the document value instead.
  const rawId = (props.value?._id as string | undefined) ?? undefined;
  const publishedId = rawId ? getPublishedId(rawId) : '';
  const typeName = props.schemaType?.name ?? '';

  // Hooks must run unconditionally. With an empty id these return no-op/disabled
  // operations, which we further guard against below.
  const { publish } = useDocumentOperation(publishedId, typeName);
  const validationStatus = useValidationStatus(publishedId, typeName, false);

  const hasErrors = validationStatus.validation.some((m) => m.level === 'error');
  const publishDisabled = !publishedId || Boolean(publish.disabled) || hasErrors;

  const handlePublish = useCallback(() => {
    if (publishDisabled) return;
    publish.execute();
    toast.push({
      status: 'success',
      title: 'Publishing…',
      description: 'Publishing the listing.',
    });
  }, [publishDisabled, publish, toast]);

  // Derive current tab + order from the live groups prop, so the footer always
  // matches the rendered tab bar (defensive against any synthetic groups).
  const groups = props.groups ?? [];
  const selectedIndex = groups.findIndex((g) => g.selected);
  const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const nextGroup = groups[currentIndex + 1];
  const isFinalTab = groups.length > 0 && !nextGroup;

  const handleNext = useCallback(() => {
    if (nextGroup) props.onFieldGroupSelect(nextGroup.name);
  }, [nextGroup, props]);

  return (
    <Box>
      {props.renderDefault(props)}
      <Card marginTop={4} paddingTop={4} borderTop tone="transparent">
        <Flex justify="flex-end">
          {isFinalTab ? (
            <Button
              text="Publish"
              icon={PublishIcon}
              tone="positive"
              disabled={publishDisabled}
              onClick={handlePublish}
            />
          ) : (
            <Button
              text="Next"
              iconRight={ArrowRightIcon}
              mode="ghost"
              tone="primary"
              disabled={!nextGroup}
              onClick={handleNext}
            />
          )}
        </Flex>
      </Card>
    </Box>
  );
}
