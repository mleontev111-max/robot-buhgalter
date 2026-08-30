# Инфраструктура Robot-Buhgalter

Этот файл хранит только подтверждённые факты. Для изменяемых внешних систем указана дата последней проверки; это не утверждение об их текущем состоянии.

## GitHub — проверено 2026-08-30

- Repository: `mleontev111-max/robot-buhgalter`.
- Default branch: `main`.
- Active recovery PR: [#3](https://github.com/mleontev111-max/robot-buhgalter/pull/3).
- Branch/SHA приведены в `PROJECT_STATE.md`.

## Backend artifact — подтверждено кодом recovery-ветки

- Build definition: `Dockerfile.backend` в корне репозитория.
- Build platform: `linux/amd64`.
- Base: `node:20.20.2-alpine3.23`.
- Workdir: `/app`.
- Runtime user/group: `app:app`.
- Port declared by image: `8788`.
- Entrypoint: `docker-entrypoint.sh`.
- Command: `node server/production/index.mjs`.
- Backend source and isolated lockfile: `server/production/`.

## Hetzner — последнее документированное подтверждение 2026-08-25

Ниже исторический проверенный снимок из read-only/server checkpoints. Перед любым будущим действием всё необходимо повторно проверить read-only.

- Hostname: `ai-vpn`.
- IPv4: `178.104.188.123`.
- OS на дату проверки: Ubuntu 24.04, Linux 6.8 x86_64.
- Docker Server на дату проверки: 29.1.3.
- Caddy: systemd service; config `/etc/caddy/Caddyfile`; public `80/443`; admin `127.0.0.1:2019`.
- Docker network: `apps-net`.
- PostgreSQL container: `project2-postgres`; PostgreSQL 16.15 на дату проверки; host port `5432` не опубликован.
- PostgreSQL data bind mount: `/opt/apps/project2/postgres/data` → `/var/lib/postgresql/data`.
- PostgreSQL compose: `/opt/apps/project2/postgres/compose.yaml`.
- Robot-Buhgalter root: `/opt/apps/robot-buhgalter/`.
- Runtime env: `/opt/apps/robot-buhgalter/.env`, mode `600 root:root` на дату проверки.
- Migration env: `/opt/apps/robot-buhgalter/.migrate.env`, mode `600 root:root` на дату проверки.
- Releases: `/opt/apps/robot-buhgalter/releases/`.
- Backups: `/opt/apps/robot-buhgalter/backups/`.
- Database: `robot_buhgalter`.
- Roles: `robot_buhgalter_owner`, `robot_buhgalter_app`, `robot_buhgalter_backup`.
- Последний документированный container: `robot-buhgalter-api-1`, loopback publish `127.0.0.1:8788`.
- Последний документированный image: `robot-buhgalter-api:20260825-1636-bootstrap-fix`.
- Последний документированный release: `20260825-1636-bootstrap-fix`.
- Backend был healthy и `/ready` возвращал database ready на дату проверки.
- UFW не публиковал `5432` или `8788` на дату проверки.
- Caddy/DNS route для public API не был настроен на дату проверки.

## Backup — последнее документированное подтверждение 2026-08-25

- Script: `/opt/apps/robot-buhgalter/backup.sh`, mode `700 root:root`.
- Grants source on server: `/opt/apps/robot-buhgalter/backup-role-grants.sql`.
- Cron: `/etc/cron.d/robot-buhgalter-backup`, ежедневно `03:20 UTC`.
- Format: PostgreSQL custom format, SHA-256 checksum, atomic `.partial` → final move, retention 14 days.
- Был подтверждён успешный dump и restore в отдельную временную database; временная database была удалена.

## Соседние сервисы — последнее документированное подтверждение 2026-08-25

- `n8n` на `127.0.0.1:5678`.
- `amnezia-awg2` на public UDP `49265`.
- Эти сервисы не относятся к Robot-Buhgalter и не должны изменяться в рамках его работ без отдельного подтверждения.

## UNCONFIRMED/TODO

- Текущее состояние Hetzner, containers, images, releases, database, backups, cron, Caddy и UFW после 2026-08-25.
- Выбранный production API hostname и его DNS records.
- Существует ли текущий production workload с реальными данными; checkpoints от 2026-08-25 фиксировали пустую database.
- Точный rollback image/tag для будущего rollout.
- Мониторинг, alerting и off-site backup policy.
