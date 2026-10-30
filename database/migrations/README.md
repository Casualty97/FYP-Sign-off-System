# Database migrations

`database/schema.sql` is the **frozen baseline**: it drops and recreates every table, so it is only ever
run on a fresh install (`Datastore_Assembly.js`, CI). Nobody edits it. CI checks its hash against
`baseline.json` and fails if it changed.

Every change to the database is a numbered file in this folder, applied once, in order:

```bash
npm run db:new -- add_hardware_samples   # creates 001_add_hardware_samples.sql
# write plain MySQL in it (CREATE TABLE, ALTER TABLE ... ADD COLUMN, INSERT seed rows, ...)
npm run db:migrate                        # applies it to your local database and records it
npm run db:snapshot                       # rebuilds database/schema.snapshot.sql (needs MYSQL_ROOT_PASSWORD)
git add database/migrations/001_add_hardware_samples.sql database/schema.snapshot.sql
```

Rules
- Never edit a migration after it has been applied anywhere. Write a new one.
- One migration per change, named after what it does, owned by the role that needs it.
- Keep migrations idempotent-safe where cheap (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN` guarded by the checker).
- `npm run db:status` shows what is applied on your machine. After `git pull`, run `npm run db:migrate`.
- `database/schema.snapshot.sql` is generated. It is the readable, current structure for the ERD and the report.
  CI rebuilds it from a scratch database and fails if it differs from the committed file.

The applied list lives in the `schema_migrations` table of each database.
