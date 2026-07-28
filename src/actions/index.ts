/**
 * Auth actions — real Supabase auth, ported from astro-users-demo.
 * ---------------------------------------------------------------------------
 * signUp / signIn / signOut / requestPasswordReset / updatePassword, each
 * gated by a Cloudflare Turnstile verification (except signOut / updatePassword,
 * which already require a session).
 *
 * Env adaptation for the Cloudflare Worker runtime (this project, NOT node):
 *   - The Supabase URL/anon key are PUBLIC_ vars read via import.meta.env inside
 *     getSupabase().
 *   - TURNSTILE_SECRET_KEY is a SERVER secret and must be read from the Worker
 *     runtime, not import.meta.env. We mirror src/chatbot/get-env.ts:
 *     `import { env } from 'cloudflare:workers'` with an import.meta.env fallback
 *     for non-Cloudflare local runs. get-env.ts itself is left untouched.
 *
 * Redirect targets are this project's routes: the authenticated area is
 * /account and the password-reset landing page is /reset-password.
 */
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { env as cfEnv } from 'cloudflare:workers';
import { getSupabase } from '../lib/supabase';

/**
 * Read the Turnstile server secret the Worker-safe way. Mirrors the pattern in
 * src/chatbot/get-env.ts (read from `cloudflare:workers`, fall back to
 * import.meta.env for non-CF local runs). This is the tiny local reader the
 * task brief calls for — get-env.ts is intentionally not edited.
 */
function getTurnstileSecret(): string | undefined {
  const e = cfEnv as unknown as Record<string, unknown>;
  return (e.TURNSTILE_SECRET_KEY as string | undefined) ?? import.meta.env.TURNSTILE_SECRET_KEY;
}

/** Resolve the site origin for email redirect links (config: PUBLIC_SITE_URL). */
function siteOrigin(request: Request): string {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || import.meta.env.SITE_URL;
  return siteUrl ? siteUrl.replace(/\/$/, '') : new URL(request.url).origin;
}

async function verifyTurnstile(token: string, remoteIp: string | null) {
  const secretKey = getTurnstileSecret();
  if (!secretKey) {
    throw new ActionError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Cloudflare Turnstile secret key is not configured.',
    });
  }

  const verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  const formData = new URLSearchParams();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (remoteIp) {
    formData.append('remoteip', remoteIp);
  }

  try {
    const res = await fetch(verifyUrl, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
    if (!data.success) {
      throw new ActionError({
        code: 'BAD_REQUEST',
        message: 'Security verification failed. Please check the Turnstile widget and try again.',
      });
    }
  } catch (err: any) {
    if (err instanceof ActionError) throw err;
    throw new ActionError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error validating security CAPTCHA: ' + err.message,
    });
  }
}

export const server = {
  signUp: defineAction({
    accept: 'json',
    input: z.object({
      name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
      email: z.string().email({ message: 'Invalid email address.' }),
      password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
      turnstileToken: z.string().min(1, { message: 'Please complete the Turnstile challenge.' }),
    }),
    handler: async (input, context) => {
      const clientIp =
        context.request.headers.get('cf-connecting-ip') ||
        context.request.headers.get('x-real-ip');

      // 1. Verify Cloudflare Turnstile token
      await verifyTurnstile(input.turnstileToken, clientIp);

      // 2. Sign up user via Supabase SSR client
      const supabase = getSupabase(context.request, context.cookies);
      const emailRedirectTo = `${siteOrigin(context.request)}/account`;

      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            name: input.name,
          },
          emailRedirectTo,
        },
      });

      if (error) {
        const message = /email rate limit exceeded/i.test(error.message)
          ? 'Email rate limit exceeded — try again in 15 minutes.'
          : error.message;

        throw new ActionError({
          code: 'BAD_REQUEST',
          message,
        });
      }

      // Auto-confirmed (session present) vs. email-confirmation-required.
      const session = data.session;
      const user = data.user;

      return {
        success: true,
        message: session
          ? 'Registration successful! You are now logged in.'
          : 'Registration successful! Please check your email to confirm your account.',
        user,
        hasSession: !!session,
      };
    },
  }),

  signIn: defineAction({
    accept: 'json',
    input: z.object({
      email: z.string().email({ message: 'Invalid email address.' }),
      password: z.string().min(1, { message: 'Password is required.' }),
      turnstileToken: z.string().min(1, { message: 'Please complete the Turnstile challenge.' }),
    }),
    handler: async (input, context) => {
      const clientIp =
        context.request.headers.get('cf-connecting-ip') ||
        context.request.headers.get('x-real-ip');

      // 1. Verify Cloudflare Turnstile token
      await verifyTurnstile(input.turnstileToken, clientIp);

      // 2. Authenticate user via Supabase SSR client
      const supabase = getSupabase(context.request, context.cookies);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      });

      if (error) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'Invalid email or password. Please try again.',
        });
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
      };
    },
  }),

  signOut: defineAction({
    accept: 'json',
    handler: async (_input, context) => {
      const supabase = getSupabase(context.request, context.cookies);
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return { success: true };
    },
  }),

  requestPasswordReset: defineAction({
    accept: 'json',
    input: z.object({
      email: z.string().email({ message: 'Invalid email address.' }),
      turnstileToken: z.string().min(1, { message: 'Please complete the Turnstile challenge.' }),
    }),
    handler: async (input, context) => {
      const clientIp =
        context.request.headers.get('cf-connecting-ip') ||
        context.request.headers.get('x-real-ip');

      // 1. Verify Cloudflare Turnstile token
      await verifyTurnstile(input.turnstileToken, clientIp);

      // 2. Send the password-reset email. The link lands on /reset-password,
      // where the code is exchanged for a short-lived session so the user can
      // set a new password.
      const supabase = getSupabase(context.request, context.cookies);
      const redirectTo = `${siteOrigin(context.request)}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
        redirectTo,
      });

      // Surface rate-limit errors, but never reveal whether an account exists
      // for the given email (prevents account enumeration).
      if (error && /rate limit/i.test(error.message)) {
        throw new ActionError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests — please try again in a few minutes.',
        });
      }

      return {
        success: true,
        message: "If an account exists for that email, we've sent a password reset link.",
      };
    },
  }),

  updatePassword: defineAction({
    accept: 'json',
    input: z.object({
      password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
    }),
    handler: async (input, context) => {
      // A valid session must already exist — established by exchangeCodeForSession
      // on the /reset-password page after the user clicks the emailed link.
      const supabase = getSupabase(context.request, context.cookies);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'Your reset link is invalid or has expired. Please request a new password reset.',
        });
      }

      const { error } = await supabase.auth.updateUser({ password: input.password });

      if (error) {
        const message = /New password should be different/i.test(error.message)
          ? 'Your new password must be different from your current password.'
          : error.message;

        throw new ActionError({
          code: 'BAD_REQUEST',
          message,
        });
      }

      // Invalidate the recovery session so the user signs in fresh with the new password.
      await supabase.auth.signOut();

      return { success: true };
    },
  }),
};
