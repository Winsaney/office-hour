# YC Office Hours

A single-file HTML app that acts as a YC-style partner to pressure-test your startup idea. Powered by AI (Claude or OpenAI-compatible models like DeepSeek), it asks 6 forcing questions to help you validate your wedge, target user, and core problem.

## Features

- **Single file, zero backend** — open `index.html` and go
- **Two modes** — Startup (6 forcing questions + design doc) and Builder (hackathon/side project)
- **Multi-provider AI** — Claude (Anthropic) or any OpenAI-compatible API (DeepSeek, Together, Groq, etc.)
- **Bilingual** — full EN/ZH UI toggle, AI responds in your selected language
- **Cloud sync via Supabase** — sign in with Google/GitHub to sync sessions across devices
- **Offline-first** — all data saved to localStorage; cloud is optional and silently degrades
- **Design doc generation** — auto-summarizes the session into a copyable design document

## Quick Start

### 1. Using Claude API

1. Open `index.html` in a browser (via HTTP server, e.g. `npx serve .`)
2. Click **Settings** in the header
3. Select "Claude (Anthropic)" and enter your API Key
4. Close settings, pick a mode, describe your idea

### 2. Using OpenAI-compatible APIs (DeepSeek, etc.)

Some providers have strict CORS policies. Use the included proxy:

```bash
node proxy.js
```

Then in Settings:
- Select **OpenAI Compatible**
- Enter your API Key, Endpoint (e.g. `https://api.deepseek.com/v1/chat/completions`), and Model
- Check **Use Local CORS Proxy (localhost:3456)**

### 3. Cloud Sync (Optional)

Sign in with Google or GitHub to sync your sessions across devices. Without signing in, everything stays in localStorage — the app works exactly the same.

## Supabase Setup

To enable cloud sync for your own deployment:

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Run the schema** — paste `supabase_schema.sql` into the SQL Editor
3. **Enable OAuth providers** — Dashboard > Authentication > Providers > enable Google and/or GitHub
4. **Configure OAuth apps** — register your app in [Google Cloud Console](https://console.cloud.google.com/auth/clients) and/or GitHub Settings > Developer settings > OAuth Apps. Add the Supabase callback URL as a redirect URI.
5. **Set credentials** — replace `SB_URL` and `SB_KEY` in `index.html` with your project URL and publishable key

> API Keys are **never** synced to the cloud. They stay in localStorage only. Preferences (provider, endpoint, model, language) sync on sign-in.

## Project Structure

```
index.html            — Complete app (HTML + CSS + JS)
proxy.js              — Local CORS proxy for OpenAI-compatible APIs
supabase_schema.sql   — Database schema, RLS policies, and GRANTs
supabase_mvp_plan.md  — Original implementation plan
```

## Architecture

```
Browser
├── localStorage (always, offline fallback)
├── Supabase Auth (Google/GitHub OAuth)
├── Supabase DB (sessions + user_preferences)
└── AI API (Claude or OpenAI-compatible, direct from browser)
```

**Data flow:**
- Not signed in → all data in localStorage, zero changes to existing behavior
- Signed in → localStorage + cloud sync; first login auto-uploads existing local data
- Offline → silently falls back to localStorage, cloud writes queue and retry

## Security

- API Keys stored only in `localStorage`, never sent to Supabase
- Supabase publishable key is safe for client-side code; security enforced by RLS
- RLS policies ensure users can only access their own data
- Explicit `GRANT` statements (required since Supabase April 2026) — no accidental data exposure

---
*Built to help founders build what people want.*
