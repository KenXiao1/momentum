# Database and persistence changes

Momentum's backend is Supabase (PostgreSQL, RLS, and RPCs), without a custom
application server. [Schema reference](../api/DATABASE_SCHEMA.md) describes the
tables; ordered SQL in [supabase/migrations](../../supabase/migrations/) defines
the database. `sql/` contains manual diagnostic scripts, not migration history.

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

## Applying migrations

Use the Supabase CLI with the intended project or local database. The
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

Verify the changed columns, constraints, and RPC behavior, including authorized,
unauthenticated, and cross-user requests where access rules changed. Deployment
target selection and live data changes belong to the deployment task, not an
ordinary code refactor.
