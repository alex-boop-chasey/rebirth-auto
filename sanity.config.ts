import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './src/sanity/schemaTypes';
import { listingTemplates } from './src/sanity/templates';

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
  // The "Generate description" trigger now lives on the description field itself
  // (src/sanity/components/GenerateDescriptionInput.tsx), not as a document
  // action — so it sits right under the dealer notes it draws from.
});
