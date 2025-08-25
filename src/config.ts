// Central configuration and constants
export const MODEL = process.env.FINE_TUNED_MODEL || 'gpt-4o-mini';
export const PORT = process.env.PORT || 3000;

export const PROVIDERS = {
  OPENAI: 'openai',
  HTTP: 'http',
};
