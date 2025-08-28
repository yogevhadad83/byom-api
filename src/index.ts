import 'dotenv/config';
import { PORT } from './config.js';
import app from './app.js';

// Compute CORS origins from env (comma-separated)
const corsEnv = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const originsSummary = corsEnv.length ? corsEnv.join(', ') : '*';

// Check Supabase env presence for startup summary
const supaConfigured = Boolean(
  String(process.env.SUPABASE_URL || '').trim() &&
    String(process.env.SUPABASE_ANON_KEY || '').trim(),
);

app.listen(PORT, () => {
  console.log(
    `byom-api listening on :${PORT} | CORS: ${originsSummary} | Supabase configured: ${supaConfigured ? 'yes' : 'no'}`,
  );
});
