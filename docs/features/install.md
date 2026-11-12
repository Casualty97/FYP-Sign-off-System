# Install and uninstall scripts

Owner: Role 3, Jun Kai. Task-sheet point 5, "installation and deletion scripts" for the application (built 12 Nov 2026).

## In short

| Command (in the project folder) | What happens |
|---|---|
| `install.cmd` (or double-click it) | asks Laptop or Wall PC, then sets the kiosk up |
| `install.cmd -Role Laptop` | a development laptop: packages, `backend\.env`, database; Windows is left alone |
| `install.cmd -Role WallPC` | the kiosk PC: the same, plus start at logon, a desktop link and the firewall rule |
| `install.cmd -Check` or `npm run doctor` | only reports what is set up |
| `uninstall.cmd` | stops the kiosk and removes everything the install and the kiosk added to Windows |
| `uninstall.cmd -RemoveData` | also drops the database (you type its name) and deletes `backend\data` (but not the archive zips in `backend\data\archives`), `backend\cache` and `logs` |
| `-DryRun` on either | prints every step, changes nothing |

Other switches: `-NonInteractive` (no questions; the safe answer is taken, so nothing risky happens without a switch
that asks for it), `-SkipNpm`, `-ConfirmDatabase <name>` (uninstall `-RemoveData` without the question).

Not here on purpose: hibernate and wake timers. They are Role 4's (Ryan) task-sheet line "Set up server hibernation
scheduling at the system level", so neither script touches the power plan. Once that part is on main, the installer
gets the matching step (the user's rule of 12 Nov 2026: keep the installer in step with main).

## Files

| File | Job |
|---|---|
| `install.cmd`, `uninstall.cmd` | double-click wrappers: run the PowerShell script with `-ExecutionPolicy Bypass` for that one run only, keep the window open after a double-click |
| `scripts/install/install.ps1` | programs check, `npm ci`, calls `setup.js`, the Wall PC steps, the `-Check` report |
| `scripts/install/uninstall.ps1` | stops the kiosk, removes the Windows parts, optional data removal |
| `scripts/install/common.ps1` | the names both scripts use and small helpers (Windows PowerShell 5.1 is enough, files stay ASCII) |
| `scripts/install/setup.js` | `backend/.env` and the database, in Node (unit tests: `tests/unit/installSetup.test.js`) |

## What install does, in order

1. **Programs.** Node.js 22 or newer, npm, a running MySQL service. Git and Ollama (with `qwen2.5:3b`) are optional
   and only reported. Anything missing stops the install with what to install.
2. **Packages.** `npm ci`. Skipped with `-SkipNpm`, or when `node_modules` is a link to another folder (so that
   folder is never emptied). If the kiosk is running from this folder it asks to stop it first (npm cannot replace
   files in use).
3. **Settings.** `backend/.env` is made from `backend/.env.example` if it is missing. Only empty keys are filled:
   `SESSION_SECRET` (random) and `ENCRYPTION_KEY` (random, see below). `KIOSK_AUTOMATION` follows the role: `off` on a
   laptop (a schedule must never hibernate it), `on` on the Wall PC. A value that is filled in is never replaced, and no
   value is ever printed.
4. **Database.** It logs in as `DB_USER`. If that user cannot log in, or may not create the database, it asks once for
   the MySQL root password (typing is hidden; it is never put on a command line) and creates the database, creates the
   user and gives it its rights. `database/schema.sql` starts with `DROP TABLE`, so it is only loaded into an **empty**
   database; then every migration is applied. A database that has tables is never dropped: running install again only
   applies new migrations. It ends with a check: at least 14 tables, an admin account, no migration pending. On a fresh
   database it prints the first login (`systemadmin`, change the password in User Management).
5. **Wall PC, as the user:** a shortcut in the Startup folder starts `node startAll.js` at logon (minimised window), and
   an "ESG Kiosk Admin" link to `https://localhost:<PORT>/admin` goes on the desktop.
6. **Wall PC, as administrator** (Windows asks; a second, elevated window does only this part): a firewall rule
   "ESG Kiosk - tablets to the kiosk server" for TCP 3000 and 3003 on Private and Domain networks (never Public).

## What uninstall does, in order

1. Stops the kiosk: only the `node.exe` processes whose command line names a file in this folder (and the
   `startAll.js` parent of those). Never "every node.exe", never "whatever listens on port 3000".
2. Removes the Startup shortcut (only if it starts a copy in this folder) and the desktop link.
3. As administrator: removes the firewall rule.
4. With `-RemoveData` and the database name typed again: drops the database and deletes `backend\data` (except
   `backend\data\archives`, the default folder of the Visitor Data Archive zips),
   `backend\cache` and `logs`.
5. Stays on purpose: the program folder (delete it by hand), `uploads\photos`, the archive zips, `backend\.env` (its key
   is the only one that opens them), the MySQL user, and Node.js, MySQL and Ollama themselves.

## Encryption key

`ENCRYPTION_KEY` encrypts visitor emails and the Visitor Data Archive files. An empty key means the public development
key in `backend/core/auth.js` is used. The installer only creates a key while the database holds no encrypted email and
no archive; otherwise it leaves the key empty and says so, because a new key would make those unreadable. Keep a copy of
`backend\.env` somewhere safe: an archive can only be opened with the key that wrote it.

## Notes

- `backend/.env` is still tracked in git (from the previous team). After the installer fills it, never commit it; the
  installer reminds you at the end.
- `setup.js` exit codes: 0 done, 1 failed, 2 the root password is needed but there was no way to ask (set
  `ESG_MYSQL_ROOT_PASSWORD`, or `--root-password-empty` for a root without a password).
- CI: the Windows smoke job runs `install.ps1 -Check`, a Wall PC dry run and an uninstall dry run under Windows
  PowerShell 5.1.

## How to test on a laptop

```powershell
.\install.cmd -Check
.\install.cmd -DryRun -Role WallPC
.\install.cmd -Role Laptop        # fills empty keys of backend\.env, KIOSK_AUTOMATION=off, applies new migrations
.\uninstall.cmd -DryRun -RemoveData
```

Do not run `uninstall.cmd -RemoveData` on a copy whose database you need, and do not run the Wall PC install on a
laptop unless you want the kiosk to start at logon.
