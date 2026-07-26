import { createElement } from 'react';
import { defineConfig, type InputProps, type ObjectInputProps } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './src/sanity/schemaTypes';
import { listingTemplates } from './src/sanity/templates';
import { ListingFormFooter } from './src/sanity/components/ListingFormFooter';

export default defineConfig({
  name: 'default',
  title: 'astro-listings-demo',
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: import.meta.env.PUBLIC_SANITY_DATASET,
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
    // Append the listing templates to Sanity's auto-generated defaults so the
    // blank "Listing" create option survives alongside the two presets.
    templates: (prev) => [...prev, ...listingTemplates],
  },
  form: {
    components: {
      // Root-level form override, scoped to the LISTING document form only.
      // Renders the per-tab Next / final-tab Publish footer. This composes
      // cleanly with the field-level `GenerateDescriptionInput` input override
      // on `description` — root-level (id === 'root') and field-level input
      // overrides are independent and both call `renderDefault`.
      input: (props: InputProps) => {
        if (props.id === 'root' && props.schemaType?.name === 'listing') {
          // Render as a proper React element (createElement, not a bare function
          // call) so the footer's hooks run in their own component instance —
          // keeps the config a plain `.ts` file without the rules-of-hooks risk
          // of invoking a hook-using component as a function.
          return createElement(ListingFormFooter, props as ObjectInputProps);
        }
        return props.renderDefault(props);
      },
    },
  },
  // The "Generate description" trigger lives on the description field itself
  // (src/sanity/components/GenerateDescriptionInput.tsx), not as a document
  // action — so it sits right under the dealer notes it draws from.
});
