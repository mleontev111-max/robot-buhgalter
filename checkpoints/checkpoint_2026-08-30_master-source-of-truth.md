# MASTER CHECKPOINT — единый source of truth

## Мета-информация

- Дата: **2026-08-30 20:57 MSK**.
- Repository: `mleontev111-max/robot-buhgalter`.
- Документируемая ветка: `recovery/production-backend-2026-08-27`.
- Base recovery SHA: `bee7919529ce86c4cdad9b2b1d9fbae2e2f1e963`.
- Production changes: **не выполнялись**.
- Secrets: **не читались и не записывались**.

## Сверка GitHub

- `main`: `57f9ccfb7c9d95f65109511b66f31f7f00562f46`.
- Recovery: `bee7919529ce86c4cdad9b2b1d9fbae2e2f1e963` до документационного commit.
- PR #3: open, draft, mergeable, clean; recovery → main.
- PR #3 содержит 3 commits и 23 changed files до документационного commit.
- Последний подтверждённый blocker: образ из `Dockerfile.backend` ещё не был реально собран и проверен Docker-mode PostgreSQL + HTTP integration flow.

## Созданная система

- `PROJECT_STATE.md` — единственный текущий статус и следующий шаг.
- `INFRASTRUCTURE.md` — проверенная карта инфраструктуры с датами проверки.
- `ACCESS_MAP.md` — доступ без secret values.
- `RUNBOOK.md` — точные безопасные команды, включая Docker gate.
- `RECOVERY.md` — восстановление доступа, runtime и data.
- `checkpoints/` — неизменяемый журнал состояния; этот файл является master checkpoint.

## Постоянные правила

1. Перед продолжением: прочитать `PROJECT_STATE.md`, `ACCESS_MAP.md`, последний checkpoint и сверить GitHub.
2. Перед остановкой: выполнить `checkpoint-before-stop`.
3. Никакая ключевая информация не остаётся только в chat.
4. Unknown не превращается в предположение: записывается `UNCONFIRMED/TODO`.
5. Secrets никогда не попадают в repository или checkpoints.

## Текущий P0

Выполнить команды раздела «PR #3: обязательный Docker gate» в `RUNBOOK.md` на подтверждённой developer machine/CI с Docker Engine и pull access. Не использовать production directory и не deploy.

## UNCONFIRMED/TODO для однократного установления

1. Канонический локальный путь repository на Mac и machine label.
2. Работает ли Docker Engine на этой машине.
3. Где безопасно хранится GitHub credential.
4. Где находится действующий Hetzner private SSH key и его защищённая резервная копия.
5. Кто владеет Hetzner account/console и точная recovery procedure.
6. Есть ли внешнее защищённое backup/vault для `.env` и `CREDENTIALS_ENCRYPTION_KEY`.
7. Текущее состояние Hetzner после последней проверки 2026-08-25.
8. Production API hostname/DNS.
9. Подтверждённый rollback image/tag.
10. Off-site backup policy и RPO/RTO.

## Следующая контрольная точка

После Docker gate: записать full SHA, image tag, окружение, версии Docker, результаты unit/integration tests и решение по готовности PR #3 к review/merge.
