import { defineArrayMember, defineField, defineType } from 'sanity';
import type { ComponentType } from 'react';
// v5 removed most icons from the package root entry — import from the subpath.
import { DocumentIcon } from '@sanity/icons/Document';
import { CAR_MAKE_OPTIONS } from '../../lib/makes';
import { BASE_COLOUR_OPTIONS } from '../../lib/listing';
import { dealerConfig } from '../../config/dealer';
import { SEAT_OPTIONS } from '../../lib/listings-query';
import { GenerateDescriptionInput } from '../components/GenerateDescriptionInput';

/**
 * Core listing document (automotive).
 *
 * The form is organised into document tabs (`groups`) so authoring is clean:
 * Details (identity + specs merged), Registration, Pricing & status, Media, and
 * Description & notes (dealer notes + description, last). Most shopper-facing
 * dimensions are now FIRST-CLASS typed fields (with
 * dropdowns where the value set is fixed) rather than living in the free-form
 * `details[]` array — that array is now just an escape hatch for genuine
 * one-offs. `vehicleSpecs` is untouched (every filter/chatbot/AI query reads
 * `vehicleSpecs.<field>`); its `year`/`seats` are surfaced as dropdowns.
 */
export const listing = defineType({
  name: 'listing',
  title: 'Listing',
  type: 'document',
  icon: DocumentIcon,
  groups: [
    { name: 'details', title: 'Details', default: true },
    { name: 'registration', title: 'Registration' },
    { name: 'pricing', title: 'Pricing & status' },
    { name: 'media', title: 'Media' },
    { name: 'content', title: 'Description & notes' },
  ],
  fields: [
    // --- DETAILS --------------------------------------------------------------
    // Identity + specs are consolidated into one "Details" tab.
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      group: 'details',
      description: 'The listing name (e.g. "2021 Toyota RAV4 GXL").',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'details',
      description: 'Auto-generated from the title.',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'make',
      title: 'Make',
      type: 'string',
      group: 'details',
      description: 'Manufacturer. Choose from the list.',
      options: {
        list: CAR_MAKE_OPTIONS.map((m) => ({ title: m, value: m })),
      },
    }),
    defineField({
      name: 'model',
      title: 'Model',
      type: 'string',
      group: 'details',
      description: 'e.g. "RAV4", "Ranger".',
    }),
    defineField({
      name: 'badge',
      title: 'Badge',
      type: 'string',
      group: 'details',
      description: 'Variant/grade, e.g. "GXL", "Wildtrak".',
    }),
    defineField({
      name: 'series',
      title: 'Series',
      type: 'string',
      group: 'details',
      description: 'Model series/code, e.g. "PX III", "MZEA12R".',
    }),
    defineField({
      name: 'colour',
      title: 'Paint colour',
      type: 'string',
      group: 'details',
      description: "The manufacturer's paint name, e.g. 'Snowflake White Pearl'.",
    }),
    defineField({
      name: 'engine',
      title: 'Engine',
      type: 'string',
      group: 'details',
      description: 'e.g. "2.0L 4cyl petrol", "2.8L turbo-diesel".',
    }),
    defineField({
      name: 'doors',
      title: 'Doors',
      type: 'number',
      group: 'details',
      options: { list: [2, 3, 4, 5] },
    }),
    defineField({
      name: 'trim',
      title: 'Trim / interior',
      type: 'string',
      group: 'details',
      description: 'Interior trim/upholstery, e.g. "Black leather".',
    }),

    // Typed automotive spec fields (part of the Details tab). Unlike the
    // free-form `details` array below, these are first-class enums/numbers so
    // the search + filter feature can query them reliably (URL params use the
    // lowercase enum codes). DO NOT rename or move these sub-fields — every
    // filter/chatbot/AI query reads `vehicleSpecs.<field>`.
    defineField({
      name: 'vehicleSpecs',
      title: 'Vehicle specs',
      type: 'object',
      group: 'details',
      description: 'Typed, filterable automotive dimensions.',
      options: { collapsible: false },
      fields: [
        defineField({
          name: 'bodyType',
          title: 'Body type',
          type: 'string',
          description: 'Overall body style. Filterable.',
          options: {
            list: [
              { title: 'Sedan', value: 'sedan' },
              { title: 'Hatchback', value: 'hatchback' },
              { title: 'SUV', value: 'suv' },
              { title: 'Ute', value: 'ute' },
              { title: 'Wagon', value: 'wagon' },
              { title: 'Van', value: 'van' },
              { title: 'Coupe', value: 'coupe' },
              { title: 'Convertible', value: 'convertible' },
            ],
          },
        }),
        defineField({
          name: 'colour',
          title: 'Colour',
          type: 'string',
          description: 'Base colour family — powers search & filtering.',
          options: {
            list: BASE_COLOUR_OPTIONS.map((c) => ({ title: c.title, value: c.value })),
          },
        }),
        defineField({
          name: 'transmission',
          title: 'Transmission',
          type: 'string',
          description: 'Gearbox type. Filterable.',
          options: {
            list: [
              { title: 'Automatic', value: 'auto' },
              { title: 'Manual', value: 'manual' },
            ],
          },
        }),
        defineField({
          name: 'fuelType',
          title: 'Fuel type',
          type: 'string',
          description: 'Fuel/energy source. Filterable.',
          options: {
            list: [
              { title: 'Petrol', value: 'petrol' },
              { title: 'Diesel', value: 'diesel' },
              { title: 'Hybrid', value: 'hybrid' },
              { title: 'Electric', value: 'electric' },
              { title: 'LPG', value: 'lpg' },
            ],
          },
        }),
        defineField({
          name: 'driveType',
          title: 'Drive type',
          type: 'string',
          description: 'Driven wheels. Filterable.',
          options: {
            list: [
              { title: '2WD', value: '2wd' },
              { title: 'AWD', value: 'awd' },
              { title: '4WD', value: '4wd' },
            ],
          },
        }),
        defineField({
          name: 'seatCount',
          title: 'Seats',
          type: 'number',
          description: 'Number of seats. Filterable.',
          options: { list: [...SEAT_OPTIONS] },
          validation: (Rule) => Rule.integer().min(1).max(20),
        }),
        defineField({
          name: 'year',
          title: 'Year',
          type: 'number',
          description: 'Model/build year. Filterable.',
          options: { list: [...dealerConfig.inventory.yearOptions] },
          validation: (Rule) => Rule.integer().min(1900),
        }),
        defineField({
          name: 'odometer',
          title: 'Odometer (km)',
          type: 'number',
          description: 'Odometer reading in kilometres. Filterable.',
          validation: (Rule) => Rule.min(0),
        }),
        defineField({
          name: 'fuelEconomy',
          title: 'Fuel economy (L/100km, combined)',
          type: 'number',
          description: 'Combined-cycle fuel consumption in L/100km. Leave blank if unknown — never guess.',
          validation: (Rule) => Rule.min(0).max(60).precision(1),
        }),
        defineField({
          name: 'condition',
          title: 'Condition',
          type: 'string',
          description: 'Sale condition. Filterable.',
          options: {
            list: [
              { title: 'New', value: 'new' },
              { title: 'Used', value: 'used' },
              { title: 'Demo', value: 'demo' },
            ],
          },
        }),
      ],
    }),

    // Escape hatch: rare one-offs only. The standard specs now have their own
    // typed fields above. Field KEY stays `details` (renaming would need a data
    // migration); sub-field shape is unchanged so existing data keeps rendering.
    defineField({
      name: 'details',
      title: 'Extra details',
      type: 'array',
      group: 'details',
      description:
        'Rare one-offs only (sunroof, tow bar, service history). The standard ' +
        'specs now have their own fields above — use those first.',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'detail',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              description: 'e.g. "Sunroof", "Tow bar", "Service history".',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'value',
              title: 'Value (display)',
              type: 'string',
              description:
                'Human-readable display override, e.g. "142,000 km", "2019", "Good". ' +
                'For number values this can be derived from Value (number) + Unit, but an ' +
                'explicit value allows custom formatting.',
            }),
            defineField({
              name: 'valueType',
              title: 'Value type',
              type: 'string',
              description: 'How the value should be interpreted (drives sorting/filtering).',
              options: { list: ['text', 'number', 'boolean', 'date'], layout: 'radio' },
              initialValue: 'text',
            }),
            defineField({
              name: 'valueNumber',
              title: 'Value (number)',
              type: 'number',
              description:
                'Used when Value type is "number" (e.g. odometer 142000, bedrooms 3, ' +
                'year 2019). Kept separate from the display value for sorting and filtering.',
            }),
            defineField({
              name: 'unit',
              title: 'Unit',
              type: 'string',
              description:
                'Optional display unit for number values (e.g. "km", "miles", "sqm", "acres").',
            }),
            defineField({
              name: 'valueBoolean',
              title: 'Value (boolean)',
              type: 'boolean',
              description: 'Used when Value type is "boolean" (e.g. "Has Pool", "Pet Friendly").',
            }),
            defineField({
              name: 'valueDate',
              title: 'Value (date)',
              type: 'string',
              description: 'ISO date string, used when Value type is "date".',
            }),
          ],
          preview: {
            select: { title: 'label', subtitle: 'value' },
          },
        }),
      ],
    }),

    // --- REGISTRATION ---------------------------------------------------------
    defineField({
      name: 'vin',
      title: 'VIN',
      type: 'string',
      group: 'registration',
      description: '17-character Vehicle Identification Number.',
      // Data is dirty (imported), so a wrong length WARNS rather than blocks save.
      validation: (Rule) => Rule.length(17).warning('A VIN is usually 17 characters.'),
    }),
    defineField({
      name: 'registrationPlate',
      title: 'Registration plate',
      type: 'string',
      group: 'registration',
      description: 'Number plate. Staff-only — never shown to buyers.',
    }),
    defineField({
      name: 'registrationExpiry',
      title: 'Registration expiry',
      type: 'date',
      group: 'registration',
    }),
    defineField({
      name: 'buildDate',
      title: 'Build date',
      type: 'date',
      group: 'registration',
    }),
    defineField({
      name: 'complianceDate',
      title: 'Compliance date',
      type: 'date',
      group: 'registration',
    }),
    defineField({
      name: 'stockNumber',
      title: 'Stock number',
      // Kept as a string so leading zeros survive. Staff-only.
      type: 'string',
      group: 'registration',
      description: 'Internal stock number. Staff-only — never shown to buyers.',
    }),

    // --- PRICING & STATUS -----------------------------------------------------
    defineField({
      name: 'price',
      title: 'Price',
      type: 'number',
      group: 'pricing',
      description: 'Listed price.',
      validation: (Rule) => Rule.required().min(0),
    }),
    defineField({
      name: 'currency',
      title: 'Currency',
      type: 'string',
      group: 'pricing',
      options: { list: ['AUD', 'USD', 'GBP', 'EUR', 'NZD'] },
      initialValue: 'AUD',
    }),
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      group: 'pricing',
      options: { list: ['active', 'sold', 'pending', 'draft'], layout: 'radio' },
      initialValue: 'active',
    }),
    defineField({
      name: 'listingDate',
      title: 'Listing date',
      type: 'datetime',
      group: 'pricing',
      description: 'When the listing was created/posted.',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Updated at',
      type: 'datetime',
      group: 'pricing',
      description: 'Last updated.',
    }),
    defineField({
      name: 'category',
      title: 'Category',
      type: 'string',
      group: 'pricing',
      description: 'Fixed to "automotive" — this is an automotive-only dataset.',
      initialValue: 'automotive',
      readOnly: true,
      hidden: true,
    }),

    // --- MEDIA ----------------------------------------------------------------
    defineField({
      name: 'images',
      title: 'Images',
      type: 'array',
      group: 'media',
      description: 'Multiple images supported. The first image is used as the hero/thumbnail.',
      of: [defineArrayMember({ type: 'image', options: { hotspot: true } })],
    }),

    // --- DESCRIPTION & NOTES --------------------------------------------------
    // Final tab. Dealer notes come FIRST so the author jots shorthand, then
    // generates the buyer-facing description from it via the on-form "Generate
    // description" button. dealerNotes is private (NEVER in LISTING_FIELDS /
    // never shown to buyers); it feeds the AI generator and (future)
    // search/chat grounding.
    defineField({
      name: 'dealerNotes',
      title: 'Dealer notes (for AI)',
      type: 'text',
      rows: 4,
      group: 'content',
      description:
        "Rough shorthand like 'one owner, full service history, tow bar, no accidents'. " +
        'Not shown to buyers directly. Used by AI description generator, search, and chat.',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'array',
      group: 'content',
      description: 'Rich text description. Use "Generate description" to draft from the notes above.',
      of: [defineArrayMember({ type: 'block' })],
      // Sanity's `defineField` doesn't narrow a block array to Portable Text at
      // the type level (it infers a primitive-array input), so the correctly
      // typed PortableText input component is bridged here. Runtime is correct.
      components: { input: GenerateDescriptionInput as unknown as ComponentType<any> },
    }),
  ],
  preview: {
    select: {
      title: 'title',
      make: 'make',
      model: 'model',
      year: 'vehicleSpecs.year',
      status: 'status',
      media: 'images.0',
    },
    prepare({ title, make, model, year, status, media }) {
      const composed = [year, make, model].filter(Boolean).join(' ');
      return {
        title: title || composed || 'Untitled listing',
        subtitle: status ? status.charAt(0).toUpperCase() + status.slice(1) : undefined,
        media,
      };
    },
  },
});
