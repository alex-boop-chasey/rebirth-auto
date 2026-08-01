/**
 * Offline unit tests for the aiAttributes enrichment module.
 *
 * No test framework is wired in this repo, so this is a self-contained runner:
 *   npx tsx src/lib/generate-description/enrich-attributes.test.ts
 * It exits non-zero if any assertion fails.
 *
 * The rule assertions run fully OFFLINE — `deriveAttributes(..., { judge: false })`
 * skips the model, so no OPENROUTER_API_KEY / network is required. The most
 * important test is the Decision 6 boundary: `buildEnrichmentInput`'s output must
 * carry NONE of the private keys, even when fed an input that includes them.
 */
import assert from 'node:assert/strict';
import {
  buildEnrichmentInput,
  deriveAttributes,
  type PublicListingInput,
} from './enrich-attributes.ts';

let failures = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL  ${name}`);
    console.error(err instanceof Error ? err.message : err);
  }
}

// Private keys that must NEVER appear in the enrichment input (Decision 6).
const PRIVATE_KEYS = ['dealerNotes', 'cost', 'floor', 'floorPrice', 'costPrice'];

function assertNoPrivateKeys(obj: unknown) {
  const seen = new Set<string>();
  (function walk(v: unknown) {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        seen.add(k);
        walk(val);
      }
    }
  })(obj);
  for (const bad of PRIVATE_KEYS) {
    assert.ok(!seen.has(bad), `enrichment input must not contain private key "${bad}"`);
  }
}

await (async () => {
  console.log('Decision 6 boundary');

  // A source listing that DOES carry private fields — the choke point must strip them.
  const dirty = {
    title: '2021 Toyota RAV4 GXL',
    make: 'Toyota',
    model: 'RAV4',
    doors: 5,
    price: 38990,
    vehicleSpecs: {
      bodyType: 'suv',
      fuelType: 'petrol',
      driveType: 'awd',
      seatCount: 5,
      fuelEconomy: 6.5,
      year: 2021,
      odometer: 42000,
      condition: 'used',
      // private leakage attempts smuggled onto specs:
      cost: 31000,
      floor: 34000,
    },
    details: [{ label: 'Sunroof', value: 'Yes' }],
    // top-level private fields:
    dealerNotes: 'one owner, floor 34k, cost 31k, no accidents',
    costPrice: 31000,
    floorPrice: 34000,
  } as unknown as PublicListingInput;

  await test('buildEnrichmentInput strips every private key', () => {
    const input = buildEnrichmentInput(dirty);
    assertNoPrivateKeys(input);
    // sanity: the public fields DID survive
    assert.equal(input.make, 'Toyota');
    assert.equal(input.vehicleSpecs.bodyType, 'suv');
    assert.equal(input.vehicleSpecs.fuelEconomy, 6.5);
    assert.equal(input.details[0].label, 'Sunroof');
  });

  await test('serialized input contains no private substrings', () => {
    const json = JSON.stringify(buildEnrichmentInput(dirty));
    for (const bad of ['dealerNotes', 'floor', 'costPrice', 'floorPrice']) {
      assert.ok(!json.includes(bad), `serialized input leaked "${bad}"`);
    }
  });

  console.log('runningCost — pure rule');

  await test('EV → low', async () => {
    const { aiAttributes } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { fuelType: 'electric' } }),
      { judge: false },
    );
    assert.equal(aiAttributes.runningCost, 'low');
  });

  await test('hybrid → low', async () => {
    const { aiAttributes } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { fuelType: 'hybrid' } }),
      { judge: false },
    );
    assert.equal(aiAttributes.runningCost, 'low');
  });

  await test('fuelEconomy 5 → low, 7 → medium, 11 → high', async () => {
    const at = async (fuelEconomy: number) =>
      (await deriveAttributes(buildEnrichmentInput({ vehicleSpecs: { fuelType: 'petrol', fuelEconomy } }), { judge: false }))
        .aiAttributes.runningCost;
    assert.equal(await at(5), 'low');
    assert.equal(await at(6), 'medium'); // 6 is inclusive lower bound of medium
    assert.equal(await at(7), 'medium');
    assert.equal(await at(9), 'medium'); // 9 is still medium (>9 is high)
    assert.equal(await at(11), 'high');
  });

  await test('no EV signal + no economy → unset + warning', async () => {
    const { aiAttributes, warnings } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { fuelType: 'petrol' } }),
      { judge: false },
    );
    assert.equal(aiAttributes.runningCost, undefined);
    assert.ok(warnings.some((w) => w.startsWith('runningCost')), 'expected a runningCost warning');
  });

  console.log('sizeClass — pure rule');

  await test('hatchback → compact', async () => {
    const { aiAttributes, sources } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { bodyType: 'hatchback' } }),
      { judge: false },
    );
    assert.equal(aiAttributes.sizeClass, 'compact');
    assert.equal(sources.sizeClass, 'rule');
  });

  await test('sedan (5 seats) → medium', async () => {
    const { aiAttributes } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { bodyType: 'sedan', seatCount: 5 } }),
      { judge: false },
    );
    assert.equal(aiAttributes.sizeClass, 'medium');
  });

  await test('ute → large', async () => {
    const { aiAttributes } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { bodyType: 'ute' } }),
      { judge: false },
    );
    assert.equal(aiAttributes.sizeClass, 'large');
  });

  await test('7-seat SUV → large (seat override)', async () => {
    const { aiAttributes } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { bodyType: 'suv', seatCount: 7 } }),
      { judge: false },
    );
    assert.equal(aiAttributes.sizeClass, 'large');
  });

  await test('unmapped bodyType → unset + warning', async () => {
    const { aiAttributes, warnings } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { bodyType: 'spaceship' } }),
      { judge: false },
    );
    assert.equal(aiAttributes.sizeClass, undefined);
    assert.ok(warnings.some((w) => w.startsWith('sizeClass')), 'expected a sizeClass warning');
  });

  console.log('usageFit — rule leans (offline)');

  await test('4wd ute → towing + tradie', async () => {
    const { aiAttributes, sources } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { bodyType: 'ute', driveType: '4wd' } }),
      { judge: false },
    );
    assert.ok(aiAttributes.usageFit?.includes('towing'));
    assert.ok(aiAttributes.usageFit?.includes('tradie'));
    assert.equal(sources.usageFit, 'rule');
  });

  await test('cheap compact → city + first-car', async () => {
    const { aiAttributes } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { bodyType: 'hatchback', fuelType: 'electric' } }),
      { judge: false },
    );
    assert.equal(aiAttributes.sizeClass, 'compact');
    assert.equal(aiAttributes.runningCost, 'low');
    assert.ok(aiAttributes.usageFit?.includes('city'));
    assert.ok(aiAttributes.usageFit?.includes('first-car'));
  });

  await test('no signal at all → usageFit unset + warning', async () => {
    const { aiAttributes, warnings } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { bodyType: 'sedan', fuelType: 'petrol', fuelEconomy: 7 } }),
      { judge: false },
    );
    assert.equal(aiAttributes.usageFit, undefined);
    assert.ok(warnings.some((w) => w.startsWith('usageFit')), 'expected a usageFit warning');
  });

  await test('injected judge merges with rule leans (union, deduped)', async () => {
    const { aiAttributes, sources } = await deriveAttributes(
      buildEnrichmentInput({ vehicleSpecs: { bodyType: 'suv', seatCount: 5 } }),
      { judge: async () => ['highway', 'family', 'not-a-code' as unknown as never] },
    );
    // 'family' is a rule lean (suv); model adds 'highway'; off-enum dropped.
    assert.deepEqual([...(aiAttributes.usageFit ?? [])].sort(), ['family', 'highway']);
    assert.equal(sources.usageFit, 'model');
  });
})();

if (failures) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log('\nAll enrich-attributes tests passed.');
