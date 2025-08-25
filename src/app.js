import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';
import providerRouter from './routes/provider.js';

const app = express();

// CORS from env: CORS_ORIGIN="a,b,c" or fallback to true (allow all)
const allowed = String(process.env.CORS_ORIGIN || '')
	.split(',')
	.map(s => s.trim())
	.filter(Boolean);

const corsOptions = {
	origin: allowed.length ? allowed : true,
	methods: ['GET', 'POST', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
	credentials: false,
	optionsSuccessStatus: 204,
	preflightContinue: false,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));


app.use(express.json());

// Simple built-in health endpoints (in case healthRouter isn't mounted as expected)
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true });
});
app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/', healthRouter);
app.use('/', chatRouter);
app.use('/', providerRouter);

export default app;
