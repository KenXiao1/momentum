# Database and persistence changes

Momentum's backend is Supabase (PostgreSQL, RLS, and RPCs), without a custom
application server. [Schema reference](../api/DATABASE_SCHEMA.md) describes the
tables; new SQL in [supabase/migrations](../../supabase/migrations/) evolves
the database. Empty databases use the controlled baseline described below. `sql/` contains manual diagnostic scripts, not migration history.

## Changing persistence

Add a new migration rather than editing an applied migration. Keep user-owned
rows scoped with `auth.uid() = user_id` (or the equivalent ownership check).
`SECURITY DEFINER` RPCs must reject unauthenticated or mismatched callers
explicitly; client-side filtering does not authorize access. New SQL should
handle a null `auth.uid()` as well as a different user ID.

Supabase RPC calls use named arguments. Keep names/types aligned with callers
and avoid overloaded RPC names that make resolution ambiguous. Betting calls
are in `src/infra/storage/supabase/betting.ts`; check-in calls are in `checkin.ts`.

Alongside schema changes, update `src/lib/database.types.ts`, the affected table
modules and mappers under `src/infra/storage/supabase/`, and the schema reference
when its description changes. The type file is a checked-in schema contract;
there is no repository rule prohibiting reviewed manual updates. If regenerating
with the Supabase CLI, generate from the intended migrated schema and review the
diff rather than replacing it from an arbitrary linked database.

When a storage contract changes, update `src/storage/ports.ts` and its composition
in `MomentumStorage.ts` as needed, both local/Supabase implementations, and their
tests. The [integration harness](TESTING_GUIDE.md#automated-tests) runs the real
adapter, mapper, and SDK against MSW; new REST/RPC requests need matching handlers
in `src/test/mocks/supabaseMocks.ts`.

Existing missing-column/table fallbacks support installations whose databases
have pending migrations. Retain the relevant fallback behavior unless the task
explicitly changes the supported schema range. Test a migrated schema and the
affected compatibility path. MSW tests do not execute PostgreSQL or prove RLS;
SQL changes also need database-level validation against the intended test database.

RSIP form creation requires the existing
`20260716000000_add_atomic_rsip_intents.sql` migration. Its RPC takes
`p_intent_key`, `p_nodes`, and `p_meta` and returns the affected persisted nodes
and current metadata. The client keeps the submitted node IDs when retrying an
ambiguous response. If the RPC is absent, creation rejects without separate table
writes; those cannot provide the same atomic contract. Read compatibility and unrelated missing-column paths remain available. Atomic
collection saves (including nodes, groups, and full completion history),
completion, and imports require the storage-operation migration
below; they never fall back to separate deletion and insertion requests.

## Rebuilding an empty database

Use [the controlled baseline](../../supabase/baselines/README.md), then apply
migration files newer than `20260211000000`. Do not run the complete historical
directory from zero: its pre-baseline files cannot execute reliably in filename
order. Historical files and their checksums remain unchanged; do not repair them
in place or use the baseline over existing data. The automated database suite
validates both an empty rebuild and a populated baseline upgrade:

```sh
npm run test:database
```

The test runner uses disposable local PostgreSQL databases. Its Supabase auth
fixture models JWT subjects and roles; it does not prove a hosted project's
actual grants or migration ledger. Reconcile a deployment's schema against the
baseline and pending migrations before making a production plan.

## September 2026 transaction boundary

Apply `20260920000000_harden_points_rpc_authorization.sql` and
`20260920001000_add_storage_operation_commit.sql` together before deploying the
client that uses `commit_storage_operation(p_operation_id, p_changes)`. Each
change supplies `table`, `before`, and `after` arrays with database column names.
The caller must own every row. Existing rows use full snapshots; new rows require
stable primary keys and can omit columns with database defaults. RSIP run history
uses `(user_id, run_number)`, policy library `(user_id, id)`, and RSIP metadata
`user_id` as primary keys.

The RPC checks all snapshots before writing, uses one transaction, and records
a SHA-256 digest of its canonical JSON payload by `(user_id, operation_id)`. Retrying an identical operation
returns its receipt; reusing an ID for different content fails. A changed
snapshot fails with SQLSTATE `40001` without overwriting a competing writer.
Constraint or trigger failure rolls back all tables and the receipt. Omitted
child collections cannot be changed through cascades; requested child rows and
relations must still exist after deletions. Unchanged rows are not updated.

The current implementation locks supported collections in a fixed order with
`SHARE ROW EXCLUSIVE` locks so ordinary table writes cannot interleave with the
snapshot comparison. These locks serialize writes across users during the
transaction; this is a correctness tradeoff to measure before scaling large
imports. Receipts are retained without automatic expiry so a lost-response retry
cannot accidentally execute again. Any future retention policy must define the
client retry horizon first.

Points, bets, check-ins, audit entries, and write-session records become read-only
for clients. Authorized RPCs own their writes. Client roles also lose
`TRUNCATE`, `REFERENCES`, and `TRIGGER` privileges on public tables; those
table-wide operations are not protected by row-level policies. Ordinary
user-scoped CRUD remains available on the supported application tables.
`refund_task_bet` and
`settle_task_bet` are internal helpers with no anonymous/authenticated EXECUTE
grant. Session cancellation triggers refunds; explicit completion history uses
`metadata.session_id` to settle only the matching owned session. Imported history
without that field does not settle a live bet. Any failed payout/refund aborts
the triggering write. Bet session UUIDs remain audit references after session
deletion, replacing the old cascading foreign key that erased settled bets.
Account deletion can still cascade away that account's wallet and records.

A private `completed_session_receipts` tombstone records the verified session ID,
chain, and start time when explicit completion history is inserted. The start
time is copied from the database session into `metadata.session_started_at`.
Subsequent INSERT/UPDATE of that session ID, or the same user's chain/start time,
is rejected even if the client generates a new UUID or deletes its history.
Comparison uses millisecond precision to match JavaScript dates. A genuinely new
start time is allowed; imported history without an explicit session link does
not block new sessions. This prevents a stale pause/resume request from reviving
a session whose completion succeeded but whose response was lost.

## Applying migrations to an existing installation

After reconciling the existing migration ledger, use the Supabase CLI with the
intended project or local database. The
[CLI reference](https://supabase.com/docs/reference/cli/supabase-db-push) documents
target flags; `migration up` applies pending local migrations by default,
not one selected file.

```sh
# Apply pending migrations to the local Supabase database
supabase migration up --local

# Preview pending changes to the linked project, then apply when deploying
supabase db push --linked --dry-run
supabase db push --linked

# Generate the public schema types from a migrated local database for review
supabase gen types typescript --local --schema public > /tmp/momentum-database.types.ts
```

If using the Dashboard SQL Editor, apply the actual pending migration files in
order and reconcile migration history with the CLI afterward. Avoid copying
historical repair SQL from reports: it may omit later constraints or policies.

Before applying the September migrations, inspect the live function definitions,
ACLs, table policies, and pending migration list. After applying, run a test-account
smoke check for check-in, completion, cancellation, and operation replay.
[PostgreSQL SECURITY DEFINER guidance](https://www.postgresql.org/docs/16/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY)
and [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)
explain the separate function and table permission boundaries.

Verify the changed columns, constraints, and RPC behavior, including authorized,
unauthenticated, and cross-user requests where access rules changed. Deployment
target selection and live data changes belong to the deployment task, not an
ordinary code refactor.
