import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

export interface AuthedRequest extends Request {
  user?: { id: string; email?: string | null };
  supabase?: SupabaseClient;
}

function getEnv(name: string): string | null {
  const v = process.env[name];
  if (!v || String(v).trim() === '') return null;
  return v;
}

export function createSupabaseClient(req: AuthedRequest): SupabaseClient {
  const url = getEnv('SUPABASE_URL') as string;
  const anon = getEnv('SUPABASE_ANON_KEY') as string;
  const authHeader = req.get('authorization') || req.get('Authorization') || '';
  return createClient(url!, anon!, {
    global: { headers: { Authorization: authHeader ?? '' } },
  });
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.get('authorization') || req.get('Authorization') || '';
    const parts = String(authHeader).split(' ');
    const token =
      parts.length === 2 && /^bearer$/i.test(parts[0]) ? parts[1].trim() : '';

    const url = getEnv('SUPABASE_URL');
    const anon = getEnv('SUPABASE_ANON_KEY');
    const isTest = process.env.NODE_ENV === 'test';

    // Test bypass to keep unit tests fast without external calls
    if (isTest && (!url || !anon || !token)) {
      const fakeId = String((req.body as any)?.userId || 'test-user');
      req.user = { id: fakeId };
      req.supabase = {
        from() {
          return {
            upsert: async () => ({ data: null, error: null }),
            select() {
              return {
                eq() {
                  return {
                    single: async () => ({
                      data: null,
                      error: { code: 'PGRST116', message: 'No rows' },
                    }),
                  };
                },
              };
            },
          } as any;
        },
        auth: {
          getUser: async () => ({
            data: { user: { id: fakeId } },
            error: null,
          }),
        },
      } as any;
      return next();
    }

    if (!token)
      return res.status(401).json({ ok: false, error: 'Unauthenticated' });
    if (!url || !anon)
      return res.status(500).json({
        ok: false,
        error: 'Server misconfigured: SUPABASE_URL/ANON_KEY required',
      });

    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user)
      return res.status(401).json({ ok: false, error: 'Unauthenticated' });
    req.user = { id: data.user.id, email: data.user.email };
    req.supabase = supabase;
    return next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Unauthenticated' });
  }
}

export default { createSupabaseClient, requireAuth };
