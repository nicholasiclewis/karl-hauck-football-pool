/**
 * Shared auth helpers for edge functions.
 *
 * Why this exists: Supabase verifies a JWT on incoming function requests by
 * default, but the anon key IS a valid JWT — and the anon key ships inside the
 * frontend bundle. So "has a valid JWT" means "read our public website", which
 * is not an authorization check. Any function that then uses the service-role
 * client is bypassing RLS on behalf of an anonymous caller.
 *
 * The rule these helpers enforce:
 *   1. Identify the caller from their own token (never from the request body).
 *   2. Look their role up in the database.
 *   3. Only after that, hand back a service-role client for privileged work.
 *
 * Import from a function with:  import { requireCommissioner } from '../_shared/auth.ts'
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Service-role client. Bypasses RLS — only construct it after authorizing. */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

export type AuthResult =
  | { ok: true; userId: string; admin: SupabaseClient }
  | { ok: false; response: Response }

/**
 * Require that the caller is a signed-in commissioner.
 *
 * Returns a service-role client only on success. On failure it returns the
 * Response to send back, so call sites read:
 *
 *   const auth = await requireCommissioner(req)
 *   if (!auth.ok) return auth.response
 *   const supabase = auth.admin
 */
export async function requireCommissioner(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return { ok: false, response: json({ error: 'Unauthorized: missing Authorization header' }, 401) }
  }

  // Anon key + the caller's token. This client is bound by RLS and, crucially,
  // resolves to the actual signed-in user rather than to "anonymous".
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  // Validates the token against the auth server. A bare anon key resolves to
  // no user here, which is exactly the case we need to reject.
  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) {
    return { ok: false, response: json({ error: 'Unauthorized: not a signed-in user' }, 401) }
  }

  // Role comes from the database, never from the request.
  const { data: profile, error: profileErr } = await userClient
    .from('users')
    .select('is_commissioner')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile?.is_commissioner) {
    return { ok: false, response: json({ error: 'Forbidden: commissioner role required' }, 403) }
  }

  return { ok: true, userId: user.id, admin: adminClient() }
}

/**
 * For functions that run on a schedule and have no user context.
 *
 * Accepts either a matching x-cron-secret header (the scheduler) or a
 * signed-in commissioner (manual trigger from the dashboard).
 *
 * If CRON_SECRET is unset the secret path is refused outright rather than
 * silently allowing everyone — an unset secret must never mean "open".
 */
export async function requireCronOrCommissioner(req: Request): Promise<AuthResult> {
  const expected = Deno.env.get('CRON_SECRET')
  const provided = req.headers.get('x-cron-secret')

  if (expected && provided && timingSafeEqual(expected, provided)) {
    return { ok: true, userId: 'cron', admin: adminClient() }
  }

  return await requireCommissioner(req)
}

/** Constant-time string compare, so a wrong secret leaks nothing via timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
