# Git workflow

Short version of CONTRIBUTING.md for day-to-day use.

## First time

```bash
git clone https://github.com/Casualty97/FYP-Sign-off-System.git
cd FYP-Sign-off-System          # not inside a folder whose name starts with a dot
npm ci                          # exact versions from package-lock.json
npm run hooks:install           # optional: runs the checks before every push
node scripts/setup/Datastore_Assembly.js   # creates the database (asks for the MySQL root password)
node startAll.js                # https://localhost:3000, accept the certificate warning
```

## Every task

```bash
git switch main && git pull --ff-only                 # 1. start from the latest main
npm ci && npm run db:migrate                          # 2. new packages / database changes from others
git switch -c feat/archive-export                     # 3. type/short-description: feat, fix, docs, chore, refactor, test, ci
# ... work in your own feature folder ...
npm run check                                         # 4. lint + contract checks (what CI runs)
npm run smoke                                         # 5. boots both servers against your MySQL and checks them
git add backend/features/archive tests/smoke.js       # 6. add files by name, never `git add .`
git commit -m "feat(archive): export archived photos as a zip"
git push -u origin feat/archive-export                # 7. open the pull request on GitHub, fill in the template
```

The pull request title must be `type(scope): description` because it becomes the commit on `main`.
Scopes are the feature folders (archive, tree, feedback, ...) plus core, ci, docs, deps, db, tests, scripts.

CI runs on the pull request: title rules, forbidden files, secret scan, lint, contract checks, and a boot of both
servers on Ubuntu and Windows. Fix anything red, push again, then ask the owner of the folder to review.
Merge with "Squash and merge".

## Rules that save everyone time

- Never commit visitor photos, logs, `backend/.env`, certificates, `backend/data/` or `node_modules`.
  `.gitignore` blocks them and CI refuses them.
- Never edit `database/schema.sql`. Add a migration: `npm run db:new -- what_changed`, then `npm run db:migrate`
  and `npm run db:snapshot`, and commit both files.
- Changed a route? Run `npm run routes:update` and cover it in `tests/smoke.js` in the same pull request.
- Changed another role's folder? Keep the edit additive and tell the owner (see `.github/CODEOWNERS`).
- Update the OWNERSHIP block at the top of a file when you change it.

## Undoing things

```bash
git restore file.js                 # throw away uncommitted changes to one file
git restore --staged file.js        # unstage a file
git log --oneline -10               # what happened recently
git switch main && git pull --ff-only && git branch -d feat/old   # clean up a merged branch
```

If a pull request shows conflicts, run `git pull origin main` on your branch, fix the conflicts, run `npm run check`,
and push again.
