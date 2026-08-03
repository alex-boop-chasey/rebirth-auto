/**
 * Web app manifest for the capture PWA — served dynamically so the installable
 * name/copy come from dealer config (config-as-data), not a hardcoded static
 * file. Linked ONLY from the capture pages, and `scope`/`start_url` are pinned to
 * `/capture` so installing the PWA never claims the shopper site.
 */
import type { APIRoute } from 'astro';
import { dealerConfig } from '~/config/dealer';

export const prerender = false;

export const GET: APIRoute = () => {
  const cfg = dealerConfig.capture;
  const manifest = {
    name: `${cfg.copy.appName} — ${cfg.copy.heading}`,
    short_name: cfg.copy.appName,
    description: cfg.copy.subheading,
    // Scoped to /capture ONLY — the PWA is a separate dealer surface and must not
    // claim the shopper site.
    start_url: '/capture',
    scope: '/capture',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b1220',
    theme_color: '#0b1220',
    icons: [
      { src: '/capture/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
    ],
  };
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
  });
};
