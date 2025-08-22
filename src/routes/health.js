import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.status(200).send('chat-hub alive');
});

export default router;
