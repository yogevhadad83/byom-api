/**
 * -- providers table + RLS (documented)
 * create table if not exists public.providers (
 *   user_id uuid primary key references auth.users(id) on delete cascade,
 *   provider text not null,
 *   config jsonb not null,
 *   updated_at timestamptz not null default now()
 * );
 * alter table public.providers enable row level security;
 * create policy "users manage their provider"
 *   on public.providers
 *   for all
 *   to authenticated
 *   using (auth.uid() = user_id)
 *   with check (auth.uid() = user_id);
 */
import { createClient } from '@supabase/supabase-js';
function getEnv(name) {
    const v = process.env[name];
    if (!v || String(v).trim() === '')
        return null;
    return v;
}
export default function supabaseAuth() {
    return async function supabaseAuthMiddleware(req, res, next) {
        try {
            const authHeader = req.get('authorization') || req.get('Authorization') || '';
            const parts = authHeader.split(' ');
            const token = parts.length === 2 && /^bearer$/i.test(parts[0]) ? parts[1].trim() : '';
            const url = getEnv('SUPABASE_URL');
            const anon = getEnv('SUPABASE_ANON_KEY');
            const isTest = process.env.NODE_ENV === 'test';
            // Test bypass: allow requests without real Supabase, attach a fake user/client
            if (isTest && (!url || !anon || !token)) {
                const fakeUserId = String(req?.body?.userId || 'test-user');
                req.user = { id: fakeUserId };
                // minimal fake supabase client used by routes
                req.supabase = {
                    from() {
                        return {
                            upsert: async () => ({ data: null, error: null }),
                            select() {
                                return {
                                    eq() {
                                        return {
                                            single: async () => ({ data: null, error: { code: 'PGRST116', message: 'No rows' } }),
                                        };
                                    },
                                };
                            },
                        };
                    },
                    auth: { getUser: async () => ({ data: { user: { id: fakeUserId } }, error: null }) },
                };
                return next();
            }
            if (!token)
                return res.status(401).json({ ok: false, error: 'Missing or invalid Authorization header' });
            if (!url || !anon) {
                return res.status(500).json({ ok: false, error: 'Server misconfigured: SUPABASE_URL/ANON_KEY required' });
            }
            const supabase = createClient(url, anon, {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            });
            const { data, error } = await supabase.auth.getUser();
            if (error || !data?.user) {
                return res.status(401).json({ ok: false, error: 'Unauthorized' });
            }
            req.user = data.user;
            req.supabase = supabase;
            return next();
        }
        catch (err) {
            return res.status(401).json({ ok: false, error: 'Unauthorized' });
        }
    };
}
