# Livelihood Hub

A small role-based operations workspace for stock requests, inventory, and gatepasses. Built with Vite, vanilla JavaScript, and Supabase Auth/Postgres.

## Run locally

1. Install Node.js (version 20.19+ or 22.12+).
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project's Connect/API settings. The publishable key is safe for the browser when Row Level Security is enabled.
4. Run `npm run dev` and open the local address Vite prints.

Until the environment values and database schema are set up, the login screen shows setup instructions. This app intentionally has no open sign-up. Create accounts with Supabase Auth, then insert a matching row in `profiles` using the new Auth user's UUID. See `supabase/schema.sql`.

## Roles

- `section_leader`: submit stock requests and gatepasses; see own submissions.
- `stock_requisition`: review stock requests and confirm fulfillment.
- `gatepass_verifier`: approve or reject gatepasses.
- `guard`: read approved gatepasses and their item lists.
- `admin`: read and manage inventory. User provisioning should be added through a trusted server endpoint using the Supabase Auth Admin API.

## Workflow and limitations

The UI expects the tables and relationships in `supabase/schema.sql`. Submit a request or gatepass header first, then its item lines. For a production system, wrap the two inserts in a Postgres RPC/transaction so a failed item insert cannot leave an empty header. Stock fulfillment currently changes the request status; connect it to an audited stock movement transaction before using it to adjust real inventory. Restrict verification updates to approved status fields with a database function or secure server route. Admin account creation is not implemented in this static client because the Auth Admin API secret must never be shipped to a browser.

The role enum and initial administrator are deliberately not seeded. Create the first Auth user in Supabase, add a `profiles` row with `role = 'admin'` using the SQL Editor, then create other users in Auth and add their profile rows. Disable public signups in Supabase Auth settings.
