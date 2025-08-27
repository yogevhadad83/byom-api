import 'dotenv/config';
import { PORT, MODEL } from './config.js';
import app from './app.js';

function parseCorsOrigins() {
  const allowed = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed;
}

app.listen(PORT, () => {
  const corsOrigins = parseCorsOrigins();
  const supabaseConfigured = Boolean(
    String(process.env.SUPABASE_URL || '').trim() &&
      String(process.env.SUPABASE_ANON_KEY || '').trim()
  );
  console.log(
    'byom-api listening',
    {
      port: Number(PORT),
      model: MODEL,
      cors: corsOrigins.length ? corsOrigins : '*',
      supabaseConfigured,
    }
  );
});
