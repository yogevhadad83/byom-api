import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import chatRouter from './routes/chat.js';
import providerRouter from './routes/provider.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/', healthRouter);
app.use('/', chatRouter);
app.use('/', providerRouter);

export default app;
