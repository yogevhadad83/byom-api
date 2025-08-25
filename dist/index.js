import 'dotenv/config';
import { PORT, MODEL } from './config.js';
import app from './app.js';
app.listen(PORT, () => {
    console.log(`byom-api listening on :${PORT} (MODEL=${MODEL}; credentials required; no server default key)`);
});
