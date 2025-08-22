import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PORT, MODEL } from './config.js';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/', healthRouter);
app.use('/', chatRouter);

app.listen(PORT, () => {
  console.log(`chat-hub listening on :${PORT} (MODEL=${MODEL}; defaultProvider=openai)`);
});
