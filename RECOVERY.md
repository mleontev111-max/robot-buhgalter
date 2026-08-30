# Recovery plan Robot-Buhgalter

## Общие правила

- Сначала остановить дальнейшие изменения и сохранить evidence.
- Не восстанавливать production из непроверенного backup/image.
- Не публиковать секреты в chat, Git, tickets, screenshots или shell history.
- Любое восстановление завершать проверкой, новым checkpoint и обновлением `PROJECT_STATE.md`/`ACCESS_MAP.md`.

## Потерян локальный checkout

1. Проверить GitHub repository и актуальные SHA по `PROJECT_STATE.md`.
2. Клонировать repository в новый подтверждённый путь.
3. Проверить `origin`, default branch, recovery branch и PR.
4. Прочитать `PROJECT_STATE.md`, `ACCESS_MAP.md`, последний checkpoint.
5. Записать канонический путь в `ACCESS_MAP.md` только после подтверждения.

```bash
git clone https://github.com/mleontev111-max/robot-buhgalter.git
cd robot-buhgalter
git fetch origin main recovery/production-backend-2026-08-27
```

## Потерян GitHub access

1. Использовать штатное account recovery GitHub для `mleontev111-max`.
2. Проверить ownership и repository до настройки нового credential.
3. Отозвать потерянный/скомпрометированный token или SSH key.
4. Настроить новый credential через approved credential store.
5. Место credential store сейчас **UNCONFIRMED/TODO** и должно быть установлено один раз.

## Потерян SSH access к Hetzner

1. Использовать подтверждённый Hetzner account/console; владелец аккаунта сейчас **UNCONFIRMED/TODO**.
2. Не отключать firewall и не включать password auth как постоянный workaround.
3. Добавить новый public key через штатный recovery path, затем проверить host fingerprint и hostname.
4. Отозвать потерянный key из `authorized_keys` после восстановления доступа.
5. Выполнить read-only audit из `RUNBOOK.md`.

## Потеря/компрометация `.env` или database credentials

- Server paths последнего подтверждения: `/opt/apps/robot-buhgalter/.env` и `.migrate.env`.
- Внешнее резервное хранилище secrets: **UNCONFIRMED/TODO**.
- При компрометации: ротация отдельных database credentials и application secrets, проверка logs/audit, controlled container replacement; точная утверждённая процедура **TODO**.
- При потере `CREDENTIALS_ENCRYPTION_KEY` восстановление marketplace credentials возможно только из подтверждённой защищённой копии. Если её нет, credentials нужно повторно получить у провайдеров и заменить.

## Потеря backend container/image

1. Не считать running container источником кода.
2. Взять проверенный Git commit и `Dockerfile.backend` из GitHub.
3. Собрать versioned `linux/amd64` image.
4. Прогнать полный Docker gate из `RUNBOOK.md`.
5. Rollout выполнять только по отдельному плану с подтверждённым rollback tag.

Текущий rollback tag: **UNCONFIRMED/TODO**.

## Сбой PostgreSQL/data loss

Последняя документированная схема backup на 2026-08-25:

- `/opt/apps/robot-buhgalter/backups/`;
- custom-format `pg_dump` + `.sha256`;
- daily cron `03:20 UTC`;
- retention 14 days;
- restore выполнялся в отдельную временную database с `--exit-on-error --no-owner --role robot_buhgalter_owner`.

Перед recovery повторно проверить текущие script, cron, latest successful dump и checksum. Восстанавливать сначала в новую изолированную database, проверить migrations, table counts, RLS и least privileges. Переключение production на restore требует отдельного подтверждения.

Off-site backup и disaster-recovery RPO/RTO: **UNCONFIRMED/TODO**.

## Компрометация marketplace API credentials

1. Отозвать credential у соответствующего provider.
2. Проверить audit/logs без вывода secret values.
3. Создать новый credential и сохранить только через server-side protected mechanism.
4. Не помещать credential в frontend, localStorage, backup export, Git или checkpoint.
5. Проверить masked metadata и sync отдельным ограниченным тестом.
