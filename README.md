# SitePlanner

SitePlanner builds and edits visual website sitemaps. This fork supports sitemap XML imports, large-branch and query-variation filtering, sitemap refreshes, page styling, and an optional shared public plan.

## Local development

```bash
npm install
npm run dev
```

The local Vite server includes the `/api/sitemap` reader used by URL imports and refreshes.

## Shared public plan

The Vercel version can load one public plan from Supabase. Everyone can view it; only the authenticated owner can edit and publish it.

### 1. Create the Supabase project

1. Create a Supabase project.
2. Open **Authentication → Users** and create the owner user with your email and a strong password.
3. Disable public email sign-ups in **Authentication → Sign In / Providers → Email**. This ensures that only users you create can authenticate.
4. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
5. Copy the project URL and anon/publishable key from **Project Settings → API**.

Never put the Supabase service-role key in this repository or in a `VITE_` environment variable.

### 2. Configure local environment variables

Copy `.env.example` to `.env.local` and fill in:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Restart `npm run dev` after changing environment variables.

### 3. Publish the first shared plan

1. Open SitePlanner and select or import the plan to share.
2. Select **Owner sign in** and sign in with the Supabase owner user.
3. Confirm the intended plan is active.
4. Select **Publish changes**.

The database records that user as the plan owner. Row-level security allows public reads but only that owner can update the shared record.

## Deploy to Vercel

1. Import the `impossiblepink/SitePlanner` repository into Vercel.
2. Keep the detected **Vite** framework settings.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Project Settings → Environment Variables** for Production and Preview.
4. Deploy.

Vercel builds the frontend from `dist` and runs `api/sitemap.js` as a serverless function, so sitemap URL imports and refreshes work online.

## Security model

- The shared plan can be read without signing in.
- Supabase email/password authentication unlocks editing in the interface.
- Supabase row-level security enforces owner-only publishing at the database, even if someone modifies browser code.
- Visitors may still create separate local plans in their own browser, but they cannot overwrite the shared plan.
