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

## Production — последнее документированное подтверждение 2026-08-25

Исторический read-only/server audit подтверждал Hetzner host, Docker, PostgreSQL 16, loopback-only backend, Caddy и firewall isolation. Точные host identifiers, server paths и secret locations являются чувствительными operational details и по правилам `AGENTS.md` не хранятся в публичном repository. Их утверждённое приватное место хранения пока **UNCONFIRMED/TODO**.

- Production backend использует PostgreSQL, authentication и tenant isolation.
- Marketplace credentials хранятся server-side в зашифрованном виде.
- Backend был healthy и `/ready` возвращал database ready на дату проверки.
- PostgreSQL и backend port не были опубликованы напрямую в Internet.
- Public API route не был завершён на дату проверки.
- Канонический public frontend domain: `https://kolyman.ru`.

## Backup — последнее документированное подтверждение 2026-08-25

- Был настроен отдельный automated PostgreSQL custom-format backup с SHA-256, atomic write и retention.
- Был подтверждён успешный dump и restore в отдельную временную database; временная database была удалена.

## UNCONFIRMED/TODO

- Текущее состояние Hetzner, containers, images, releases, database, backups, cron, Caddy и UFW после 2026-08-25.
- Утверждённое приватное место для operational inventory, exact server paths и access procedures.
- Выбранный production API hostname и его DNS records.
- Существует ли текущий production workload с реальными данными; checkpoints от 2026-08-25 фиксировали пустую database.
- Точный rollback image/tag для будущего rollout.
- Мониторинг, alerting и off-site backup policy.
