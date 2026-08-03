/**
 * scripts/deps-report.ts
 *
 * DEMO-ONLY TOOLING — read-only dependency version report for THIS stack.
 *
 * Prints the currently-pinned (declared) and installed versions of the key
 * dependencies that have caused real friction in this repo (Astro, the
 * Cloudflare adapter, Sanity, Tailwind, Wrangler, TypeScript). If `npm outdated`
 * is available it is shelled out to and folded in, but the script DEGRADES
 * GRACEFULLY: offline, no network, or any command failure just drops the
 * "latest/available" columns and reports the local pinned + installed versions.
 * It never writes, never upgrades, and never fails hard.
 *
 * Usage:
 *   tsx scripts/deps-report.ts            # human-readable table
 *   tsx scripts/deps-report.ts --json     # machine-readable JSON
 *
 * See docs/dependency-tracking.md for the safe-bump process this report feeds.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const asJson = process.argv.includes('--json');
const ROOT = new URL('../', import.meta.url);

/** The dependencies worth watching, in report order. */
const KEY_DEPS = [
  'astro',
  '@astrojs/cloudflare',
  '@astrojs/check',
  '@astrojs/react',
  '@astrojs/sitemap',
  'sanity',
  '@sanity/astro',
  '@sanity/client',
  '@sanity/image-url',
  'tailwindcss',
  '@tailwindcss/vite',
  'wrangler',
  'typescript',
  'tsx',
] as const;

interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface Row {
  name: string;
  declared: string | null; // range from package.json (e.g. "^7.1.0")
  installed: string | null; // resolved version in node_modules
  wanted: string | null; // from `npm outdated` (satisfies range)
  latest: string | null; // from `npm outdated` (newest published)
}

/** Read the root package.json declared ranges. */
function readDeclared(): Record<string, string> {
  const pkg = JSON.parse(
    readFileSync(new URL('package.json', ROOT), 'utf8'),
  ) as PkgJson;
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

/** Best-effort installed version from node_modules/<pkg>/package.json. */
function readInstalled(name: string): string | null {
  try {
    const p = new URL(`node_modules/${name}/package.json`, ROOT);
    const pkg = JSON.parse(readFileSync(p, 'utf8')) as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

interface OutdatedEntry {
  current?: string;
  wanted?: string;
  latest?: string;
}

/**
 * Best-effort `npm outdated --json`. Returns {} on ANY failure (offline,
 * missing npm, timeout). `npm outdated` exits non-zero when packages ARE
 * outdated but still prints valid JSON on stdout, so we parse stdout from the
 * thrown error too.
 */
function readOutdated(): Record<string, OutdatedEntry> {
  let raw = '';
  try {
    raw = execFileSync('npm', ['outdated', '--json'], {
      cwd: fileURLToPath(ROOT),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 30_000,
    });
  } catch (err) {
    // npm outdated exits 1 when anything is outdated; JSON is on stdout.
    const stdout = (err as { stdout?: string | Buffer })?.stdout;
    if (stdout) raw = stdout.toString();
  }
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, OutdatedEntry>;
  } catch {
    return {};
  }
}

function build(): { rows: Row[]; online: boolean } {
  const declared = readDeclared();
  const outdated = readOutdated();
  const online = Object.keys(outdated).length > 0;

  const rows: Row[] = KEY_DEPS.map((name) => {
    const o = outdated[name];
    return {
      name,
      declared: declared[name] ?? null,
      installed: readInstalled(name),
      wanted: o?.wanted ?? null,
      latest: o?.latest ?? null,
    };
  });
  return { rows, online };
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function printTable(rows: Row[], online: boolean): void {
  console.log('Dependency version report — key stack (read-only, no writes)\n');
  const cols: Array<[string, (r: Row) => string]> = [
    ['Package', (r) => r.name],
    ['Declared', (r) => r.declared ?? '—'],
    ['Installed', (r) => r.installed ?? '(not installed)'],
  ];
  if (online) {
    cols.push(['Wanted', (r) => r.wanted ?? '=installed']);
    cols.push(['Latest', (r) => r.latest ?? '=up-to-date']);
  }

  const widths = cols.map(([head, get]) =>
    Math.max(head.length, ...rows.map((r) => get(r).length)),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => pad(c, widths[i])).join('  ');

  console.log(line(cols.map(([h]) => h)));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  for (const r of rows) console.log(line(cols.map(([, get]) => get(r))));

  const behind = rows.filter((r) => r.latest && r.latest !== r.installed);
  console.log('');
  if (!online) {
    console.log(
      'NOTE: `npm outdated` unavailable (offline / command failed) — showing pinned + installed only.',
    );
  } else if (behind.length === 0) {
    console.log('All key deps are at their latest published version.');
  } else {
    console.log(
      `${behind.length} key dep(s) have a newer published version: ${behind
        .map((r) => `${r.name} (${r.installed ?? '?'} → ${r.latest})`)
        .join(', ')}.`,
    );
    console.log('See docs/dependency-tracking.md before bumping any of these.');
  }
}

function main(): void {
  const { rows, online } = build();
  if (asJson) {
    console.log(JSON.stringify({ online, generatedAt: null, deps: rows }, null, 2));
  } else {
    printTable(rows, online);
  }
}

main();
