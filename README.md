# Janaseva eSurvey

A household-survey demo with Supabase email/password authentication and cloud-saved survey records. Row-level security ensures each account can access only its own records.

## Supabase setup

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. In the project's **SQL Editor**, run [`supabase/schema.sql`](./supabase/schema.sql).
3. In **Project Settings → API**, copy the **Project URL** and the **publishable key** (or legacy `anon` key). Never use a `service_role` or secret key in this app.
4. Copy `.env.example` to `.env` in the project folder and fill in `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
5. In **Authentication → URL Configuration**, set the site URL to `http://127.0.0.1:3000` and allow that URL as a redirect.
6. Start the app with `npm start`, then open `http://127.0.0.1:3000`.
7. Create an account with an email address you can access. If email confirmation is enabled, confirm the email before signing in.

## Deploy to Vercel

1. Import this repository into Vercel with the project root as the **Root Directory**. `vercel.json` publishes the static app from `public/`, while `api/config.js` provides the `/api/config` serverless function; no build command is required.
2. In the Vercel project's **Settings → Environment Variables**, add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` using the values from your Supabase project. Add them for the environments you deploy, then redeploy so the function can read them.
3. In Supabase **Authentication → URL Configuration**, set the **Site URL** to your deployed site and add its URL (and any preview URLs you use) to the allowed redirect URLs.

Use only a Supabase publishable key or legacy `anon` key. Never add a service-role or secret key to Vercel.

On Windows PowerShell, copy the environment template with:

```powershell
Copy-Item .env.example .env
```

The app reads `.env` at startup. Restart `npm start` after changing it. The browser only receives the Supabase URL and publishable/anon key; the database's row-level security policies protect the records. The app never receives or uses a service-role key.

## Features

- Account sign-up, sign-in, password reset, and sign-out
- Private survey list and live dashboard counts
- Household profile, family members, individual details, and land/amenities forms
- Create, review, save, reopen, edit, and delete surveys
- Automatic update timestamps and account-scoped database policies
- Responsive layout and attributed Wikimedia Commons minister portraits

## Limits and privacy

This is a demonstration, not an official Karnataka Government service. Configure Supabase Auth and database policies as documented. Do not collect Aadhaar numbers or other highly sensitive identifiers. Supabase is a cloud service, so saved survey data is transmitted to the Supabase project you configure. Enable appropriate backups and access controls before using real personal data.
