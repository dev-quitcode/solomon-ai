# Design: Multi-Provider AI Support & Profile Settings

**Date:** 2026-03-11
**Status:** Approved

---

## Overview

Two related settings enhancements:

1. **Multi-provider AI** — support OpenAI and Google Gemini alongside Anthropic. All five AI generation features (charter, PRD, epics, stories, domain research) use whichever provider/model the user selects. Model list is fetched live from each provider's API.

2. **Profile settings** — users can update their email and password from a new Profile tab in settings.

---

## Feature 1: Multi-Provider AI

### Model String Format

Models are identified by a `provider:model-id` string stored in `user_settings.model`:

| Provider | Example value |
|----------|--------------|
| Anthropic | `anthropic:claude-sonnet-4-6` |
| OpenAI | `openai:gpt-4o` |
| Google | `google:gemini-2.0-flash` |

This format requires no separate provider column. Existing rows default to `claude-sonnet-4-6` (bare string, no prefix) — the provider layer treats bare strings as Anthropic for backwards compatibility.

### Provider Abstraction Layer

**New file:** `src/lib/ai/providers.ts`

Single exported function:

```ts
export async function generateText(options: {
  model: string           // e.g. "openai:gpt-4o"
  systemPrompt: string
  userPrompt: string
  maxTokens: number
  apiKeys: {
    anthropic?: string | null
    openai?: string | null
    gemini?: string | null
  }
}): Promise<string>
```

Internally parses the `provider:model` prefix, routes to the right SDK, and returns the text response. All five AI routes replace their direct Anthropic SDK calls with this function.

**SDK mapping:**

| Provider prefix | SDK | Package |
|----------------|-----|---------|
| `anthropic:` (or no prefix) | `@anthropic-ai/sdk` (already installed) | existing |
| `openai:` | `openai` | new |
| `google:` | `@google/generative-ai` | new |

### Live Model Fetching

**New route:** `GET /api/models`

Reads the authenticated user's stored API keys, fetches available models from each configured provider, and returns a combined list. Only providers with a configured API key are included.

Response shape:
```json
[
  { "value": "anthropic:claude-sonnet-4-6", "label": "Claude Sonnet 4.6", "provider": "Anthropic" },
  { "value": "openai:gpt-4o",               "label": "GPT-4o",            "provider": "OpenAI"    },
  { "value": "google:gemini-2.0-flash",     "label": "Gemini 2.0 Flash",  "provider": "Google"    }
]
```

**Per-provider fetching strategy:**

- **Anthropic** — no public models API. Returns a curated hardcoded list of current production models.
- **OpenAI** — `GET https://api.openai.com/v1/models`, filtered to chat-capable models (id starts with `gpt-` or `o1` or `o3`), sorted by id descending.
- **Google Gemini** — `GET https://generativelanguage.googleapis.com/v1beta/models?key={key}`, filtered to `generateContent`-capable models.

The route is server-side to avoid CORS issues with direct browser calls to provider APIs.

### Data Changes

**Migration `006_multi_provider_settings.sql`:**
```sql
alter table public.user_settings
  add column if not exists openai_api_key text,
  add column if not exists gemini_api_key text;
```

**`UserSettings` type** gains `openai_api_key: string | null` and `gemini_api_key: string | null`.

**`/api/settings` GET** — updated select to include new key columns.

**`/api/settings` PATCH** — updated to accept and upsert `openai_api_key` and `gemini_api_key`.

### Settings UI Changes

The existing AI settings section gains two new API key fields (OpenAI, Google Gemini) each with show/hide toggles. The model dropdown is replaced with a live-fetched list from `/api/models`, grouped by provider. The dropdown is disabled with a hint if no API keys are configured. Saving keys triggers a re-fetch of the model list.

---

## Feature 2: Profile Settings

### New Route: `PATCH /api/profile`

Accepts:
```json
{ "email": "new@example.com" }
```
or:
```json
{ "password": "newpassword", "current_password": "oldpassword" }
```

Uses `supabase.auth.updateUser()`. Email changes trigger Supabase's built-in confirmation email flow — the change is pending until confirmed. Password changes re-authenticate with the current password first using `supabase.auth.signInWithPassword()` before updating.

### Profile Tab (Settings Page)

New "Profile" tab alongside the existing "AI Settings" tab. Contains:

- **Full name** — reads from `profiles.full_name`, editable, saves via existing `profiles` table update.
- **Email** — current email shown, new email input, "Send confirmation email" button. Shows a success message explaining the user must confirm via email.
- **Password** — new password + confirm fields. Requires current password for verification.

Each section has its own save/submit action — name, email, and password are independent forms.

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| New | `src/lib/ai/providers.ts` | Provider-agnostic `generateText()` |
| Modify | `src/lib/ai/client.ts` | Keep `DEFAULT_MODEL`, update to `anthropic:claude-sonnet-4-6` |
| New | `src/app/api/models/route.ts` | Live model fetching endpoint |
| New | `src/app/api/profile/route.ts` | Email/password update endpoint |
| Modify | `src/app/api/settings/route.ts` | Add openai/gemini key fields |
| Modify | `src/app/api/ai/charter/route.ts` | Use `generateText()` |
| Modify | `src/app/api/ai/prd/route.ts` | Use `generateText()` |
| Modify | `src/app/api/ai/epics/route.ts` | Use `generateText()` |
| Modify | `src/app/api/ai/stories/route.ts` | Use `generateText()` |
| Modify | `src/app/api/ai/domain-research/route.ts` | Use `generateText()` |
| Modify | `src/types/index.ts` | Add `openai_api_key`, `gemini_api_key` to `UserSettings` |
| Modify | `src/app/(dashboard)/settings/page.tsx` | Provider keys UI, live model list, Profile tab |
| New | `supabase/migrations/006_multi_provider_settings.sql` | Add openai/gemini key columns |

---

## Error Handling

- If the selected model's provider key is missing at generation time → HTTP 400 with a clear message directing user to settings
- If a provider's model-fetch API returns an error → that provider is silently excluded from the list (don't block the settings page)
- Invalid `provider:model` prefix → falls back to Anthropic behaviour with an error log
- Email already in use → surface Supabase error message to user
- Wrong current password → surface auth error to user
