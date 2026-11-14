# BWallet

BWallet is a mobile-first partnership finance tracker built with Next.js, React, Supabase Postgres/Auth, and Lucide.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Supabase migration is in `supabase/migrations/20261018090000_ledgerly.sql`. Local Supabase runs as the separate `bwallet` instance on port `54421`; set keys in `.env.local`. The app includes workspace signup, invite-code joining, persistent Supabase Auth sessions, multiple businesses, partner-wallet entries, loan tracking, transaction editing, immutable edit history, reports, and responsive dashboard navigation.

To migrate an existing SQLite file:

```bash
node scripts/migrate-sqlite-to-supabase.mjs
```
