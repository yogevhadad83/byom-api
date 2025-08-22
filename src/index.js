import 'dotenv/config';
import { PORT, MODEL } from './config.js';
import app from './app.js';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';
import providerRouter from './routes/provider.js';

app.listen(PORT, () => {
  console.log(`chat-hub listening on :${PORT} (MODEL=${MODEL}; credentials required; no server default key)`);
});
