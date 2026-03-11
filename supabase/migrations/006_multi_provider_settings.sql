-- Add OpenAI and Google Gemini API key columns to user_settings
alter table public.user_settings
  add column if not exists openai_api_key text,
  add column if not exists gemini_api_key text;
