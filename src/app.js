import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';
import providerRouter from './routes/provider.js';

const app = express();

// Strict CORS for the UI origin and explicit preflight handling
const UI_ORIGIN = 'https://chat-hub-ui.onrender.com';
const corsOptions = {
	origin: [UI_ORIGIN],
	methods: ['GET', 'POST', 'OPTIONS'],
	allowedHeaders: [
		'Content-Type',
		'x-llm-provider', 'x-llm-model', 'x-llm-api-key', 'x-llm-endpoint', 'x-user-id'
	],
	credentials: false
};

app.use(cors(corsOptions));
// respond to preflight for all routes
app.options('*', cors(corsOptions));

app.use(express.json());

app.use('/', healthRouter);
app.use('/', chatRouter);
app.use('/', providerRouter);

export default app;
