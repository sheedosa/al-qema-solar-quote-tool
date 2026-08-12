# Backend (Supabase) — fully portable

The entire backend is defined by the two SQL files in this folder. It can be recreated on **any**
Supabase project, in any organization or account, in about two minutes. No data lock-in.

## Recreate from scratch

1. Create a Supabase project (free tier is fine).
2. Run [`migrations/0001_init.sql`](migrations/0001_init.sql) in the SQL editor
   (tables `leads` + `pricing_configs`, row-level security, the `activate_pricing_config` function).
3. Run [`seed.sql`](seed.sql) (publishes the bundled pricing config as the first active version).
4. Point the app at the new project: edit the two constants in
   [`../src/config.ts`](../src/config.ts) — `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   (Project Settings → API) — then `npm run deploy`.
5. Dashboard steps (one-time):
   - **Authentication → Users** → create the company admin account(s) with email + password,
     and mark the email confirmed.
   - **Authentication → Sign In / Up** → disable public email sign-ups.
   - Optionally enable leaked-password protection (Auth → password security).

## What lives where

| Piece | Where | Notes |
|---|---|---|
| Schema, RLS, activate function | `migrations/0001_init.sql` | The security model: anon can only INSERT leads and read the active config; staff (authenticated) can read leads and manage configs |
| Initial pricing data | `seed.sql` | Identical to `src/pricing/config.ts`; later versions are created from the admin panel |
| Leads (customer submissions) | database only | Export via the admin panel's CSV button, or Supabase's dashboard/backups |
| App → backend binding | `src/config.ts` | Two public constants; RLS is the security boundary, not the key |

## Moving to a different organization

Two options:

- **Supabase native transfer** (keeps URL, keys, data, users — zero code changes):
  Project Settings → General → Transfer project. The current owner must be a member of the
  destination organization.
- **Recreate** (fresh URL/keys): follow "Recreate from scratch" above, update `src/config.ts`,
  redeploy, then delete the old project. Export any real leads first via CSV.
