# Persistence operations and recovery

Task completion, interruption, import, and RSIP/history collection replacement
have explicit commit boundaries. A completed task is shown only after storage
confirms its chain changes, history record, and session removal. The completion
dialog retains its draft after a failed attempt and prevents duplicate submits.

## Local storage

The adapter serializes reads and writes using Web Locks when available and an in-process
queue otherwise. Completion and import first persist a recovery journal containing
the complete before/after values, then apply its writes. Reads recover that journal
before exposing application data. Recovery refuses to overwrite an unrelated
newer value; storage/quota errors stay visible instead of exposing partial state.

Completion receipts retain the original history record. A separate completed
session marker prevents a stale pause or resume from recreating a consumed
session after recovery. A new start time represents a new session. Import receipts
prevent the same parsed operation from appending records twice.

Reads use the same lock because they can recover an unfinished journal.
Legacy direct utility callers do not acquire the adapter's Web Lock. New domain
code must use the public storage adapter. Without Web Locks, the queue coordinates
one document; it is not a cross-document locking substitute.

## Cloud storage

`commit_storage_operation` accepts an operation ID and changes containing complete
observed row snapshots plus the intended rows. PostgreSQL checks ownership,
compares the snapshots, validates relations, and applies all changes in one
transaction. Concurrent edits produce an explicit conflict that requires a
reload. A missing RPC rejects the write; there is no delete-then-insert fallback.

The client saves the original request before sending it. An ambiguous transport
failure retains that request for an exact retry, including generated IDs. A known
SQL rejection removes the pending request so a refreshed attempt can prepare a
new snapshot. The database retains a request hash per user and operation ID;
reusing an ID with different content is rejected. Confirmed client receipts drop
their large snapshots rather than retaining a copy of all history per completion.

Collection saves remember the rows the UI observed. After their own successful
write they can refresh server-generated fields, but first compare every known
business field and row identity. They cannot silently adopt another client's edit
and overwrite it with an older UI array. Reads paginate complete collections;
the default API page limit is not treated as the complete dataset.

Completion uses an explicit session ID and start time. Imported history has no
session settlement metadata, so importing old success records does not settle a
current bet. The supported schema floor and locking tradeoffs are documented in
the [migration guide](apply-migration.md).

## Import stages

Before writing, the import workflow persists its parsed plan, including generated
IDs and dates. Its key includes the storage/account scope, source text, and import
options. Reopening an unfinished import reuses its plan and IDs, including when the
data commit succeeded but its confirmation was lost. After all stages are confirmed,
explicitly importing the same file again creates a new plan and new IDs, so a backup
can restore records that the user deleted after an earlier import.

The plan progresses through `data`, `rules`, and `committed`:

1. The data operation commits chains, completion history, and RSIP entities
   together. In local mode, pet state is part of this journal.
2. In cloud mode, pet state remains local and is saved after the cloud commit;
   retrying that assignment is safe. Exception rules also remain local and are
   imported afterward with duplicate detection. A failed rule stage is reported
   and retried without repeating the committed data stage.
3. The UI reports success only after all stages finish. State reload includes
   completion history on both success and failure.

This is a recoverable protocol across cloud and device storage, not a distributed
database transaction. Notifications, pet rewards, and task lifecycle listeners run
after a confirmed completion. These secondary callbacks are isolated from the
commit result; they are not a durable event delivery queue.

## Diagnosing a failure

Keep the original task or import draft and retry after connectivity or storage
capacity is restored. For an explicit concurrent-edit conflict, reload the current
data before editing again. Do not delete recovery journals to dismiss an error:
they may be the only record of an interrupted write.

The account settings dialog can export bounded, sanitized diagnostics containing
error categories and operation timings. It does not export task contents,
credentials, or recovery payloads. See the
[security scanning guide](SECURITY_SCANNING.md) and
[performance benchmarks](PERFORMANCE_BENCHMARKS.md) for operational checks.

Unit tests inject write failures and lost responses, PostgreSQL tests execute
authorization/rollback/concurrency behavior, and browser tests verify refresh and
visible retry behavior. These layers exercise different boundaries; an HTTP mock
does not establish that RLS or SQL locking works.
