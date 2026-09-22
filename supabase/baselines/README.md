# Controlled database baseline

`20260211000000.sql` is a schema-only PostgreSQL 16 snapshot built from the
repository's migration definitions through 2026-02-11. It is an explicit
bootstrap boundary for an **empty** public schema, followed by every migration
whose timestamp is greater than `20260211000000`. Do not restore it over an
existing installation or mark an existing project's migration ledger as applied
without comparing that project's schema and ledger first.

The historical directory cannot bootstrap an empty database as-is. Its earliest
performance script precedes the tables it indexes, three files contain literal
newline escapes, and other historical files have invalid dollar quotes,
duplicate column additions, an absent `import_sessions` dependency, renamed RPC
arguments, and `MAX(uuid)` calls unsupported by PostgreSQL. All original files
remain unchanged. `manifest.json` records their SHA-256 hashes and the exact
adjustments used to produce this separate snapshot. The snapshot also includes
`completion_history.metadata`, required by the historical completion RPC but
absent from the historical table migrations. Optional out-of-order performance
objects are excluded rather than guessed into the application schema.

The snapshot was produced with PostgreSQL 16.15 `pg_dump --schema-only
--schema=public --no-owner`. Its temporary dump restriction token was removed;
`public` creation is conditional; UUID/crypto extension creation is explicit;
UTF-8 is explicit. The manifest pins the final snapshot hash. This is a reviewed
repository baseline, **not a production dump or evidence that a particular live
project has this exact schema**.

The test harness supplies a minimal `auth.users(id)` table, the `auth.uid()` JWT
claim contract, and the `anon`, `authenticated`, and `service_role` roles. It
executes PostgreSQL permissions, RLS, functions, triggers, constraints, rollback,
and locking on a real server. It does not run GoTrue, PostgREST, Supabase Storage,
or verify a hosted project's deployment settings. The existing HTTP integration
suite covers the SDK/HTTP boundary separately.

Run `npm run test:database` (or `python3 scripts/database/run-tests.py`). With
PostgreSQL 16 server tools installed, it starts a temporary cluster listening
only on its private Unix socket and shuts it down afterward. CI uses a dedicated
PostgreSQL 16.15 service through `MOMENTUM_TEST_DATABASE_URL`; only loopback URLs
are accepted, and only freshly created `momentum_test_*` databases are dropped.
The script never loads application `.env` files or contacts a linked Supabase
project.

Two independently created databases are tested on every run:

1. Empty database → controlled baseline → all later migration files → behavioral
   tests as anonymous, authenticated without a JWT, user A, and user B.
2. Baseline with old integer points and existing check-ins → all later migrations
   → preserved data and a reward exceeding `int4` → the same behavioral tests.

The suite uses independent database connections for concurrent requests, checks
one payout/refund/check-in under retries, injects ledger failures to prove full
rollback, verifies RSIP RPC ownership and retries, and exercises collection
compare-and-swap conflicts, retained child rows, and transaction receipts. It
checks historical hashes before starting. A new baseline requires an explicit
schema review and a manifest update; new ordinary changes remain new migrations.
