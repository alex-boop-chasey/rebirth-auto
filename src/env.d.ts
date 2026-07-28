/// <reference types="astro/client" />
/// <reference types="@sanity/astro/module" />

declare namespace App {
  interface Locals {
    /**
     * The signed-in Supabase user, or null. Populated by src/middleware.ts on
     * the auth surface (/account, /login, /signup) only; undefined elsewhere.
     */
    user: import('@supabase/supabase-js').User | null;
  }
}
