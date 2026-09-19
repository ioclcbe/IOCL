# Backup and Recovery Runbook

## Implemented backup policy

`scripts/backup-postgres.sh` creates a PostgreSQL custom-format dump, a portable SHA-256 checksum and validates the dump catalog with `pg_restore --list` before reporting success.

It maintains three local retention tiers:

- Daily: `BACKUP_DIR/daily`, default 30 days.
- Weekly: Sunday UTC copies in `BACKUP_DIR/weekly`, default 365 days.
- Monthly: first-day UTC copies in `BACKUP_DIR/monthly`, default 2555 days (about seven years; replace with the client-approved policy).

Environment variables:

```text
DATABASE_URL
BACKUP_DIR
DAILY_RETENTION_DAYS
WEEKLY_RETENTION_DAYS
MONTHLY_RETENTION_DAYS
```

Local retention is not an off-site backup. Replicate dumps and checksums to a separately secured/encrypted server or object store and monitor replication failures.

## Systemd timer supplied

```bash
sudo install -d -m 0750 -o iocl-gate -g iocl-gate /var/backups/iocl-gate /etc/iocl-gate
sudo install -m 0600 deploy/backup.env.example /etc/iocl-gate/backup.env
sudo install -m 0644 deploy/iocl-gate-backup.service /etc/systemd/system/
sudo install -m 0644 deploy/iocl-gate-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now iocl-gate-backup.timer
sudo systemctl list-timers iocl-gate-backup.timer
```

Edit `/etc/iocl-gate/backup.env` before enabling it. The timer runs daily at approximately 01:15 and is persistent, so a missed run starts after the machine returns.

## Cron alternative

```cron
15 1 * * * . /etc/iocl-gate/backup.env && /opt/iocl-gate/scripts/backup-postgres.sh >> /var/log/iocl-gate-backup.log 2>&1
```

## Restore drill

1. Create an empty, isolated PostgreSQL database.
2. Set that database's URL as `DATABASE_URL`.
3. Run `scripts/restore-postgres.sh /path/to/iocl-gate-....dump`.
4. The script verifies the checksum when present and requires the operator to type `RESTORE`.
5. Run Prisma migration status and `/ready` checks.
6. Sign in with a test user, load records, export Excel and verify an IN/OUT lifecycle.
7. Record the data timestamp, restore duration, tester and result in the operations log.

Test at least quarterly and after any PostgreSQL major-version or backup-policy change. Never perform a restore drill directly against the live database.
