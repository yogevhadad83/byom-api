import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';
import providerRouter from './routes/provider.js';

const app = express();

// CORS: allow specific UI origins, limit methods/headers, and handle global preflights with 204
const ALLOWED_ORIGINS = [
	'https://byom-chat.onrender.com',
	'https://byom-api-ui.onrender.com',
	'http://localhost:5173',
	'http://127.0.0.1:5173'
];

const corsOptions = {
	origin: ALLOWED_ORIGINS,
	methods: ['GET', 'POST', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
	credentials: false,
	// Explicitly set success status for legacy clients; default is 204
	optionsSuccessStatus: 204,
	preflightContinue: false
};

app.use(cors(corsOptions));
// Respond to preflight for all routes (204)
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
