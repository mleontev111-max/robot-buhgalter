# Robot-Buhgalter: текущее состояние

> Единая оперативная точка входа. Обновлять при каждом изменении статуса и перед остановкой работы.

## Обязательный порядок начала работы

1. Прочитать `README.md`, `AGENTS.md` и `PROJECT_STATUS.md`.
2. Прочитать `PROJECT_STATE.md` и `ACCESS_MAP.md`.
3. Прочитать самый новый файл в `checkpoints/`.
4. Сверить GitHub: `main`, активную ветку, открытый PR и проверки.
5. Если GitHub расходится с документами, считать GitHub фактом, остановить выполнение изменений и сначала обновить документы.

## Снимок состояния

- Период проверки: **2026-08-30—2026-08-31 MSK**.
- Репозиторий: `mleontev111-max/robot-buhgalter`.
- Default branch: `main`.
- `main`: `b48945ba58d338fbdbeb8c1552f22eb47d93ff85` (`docs: align Robot-Buhgalter Project Ready v0`).
- Активная recovery-ветка: `recovery/production-backend-2026-08-27`.
- Recovery HEAD после первого source-of-truth commit и до синхронизации с новым `main`: `34ee5e0f4cda8dec11ff8d008d707007b5c64cd6`.
- PR: [#3 — Recovery: restore production backend from server backup](https://github.com/mleontev111-max/robot-buhgalter/pull/3).
- PR #3: `OPEN`, `DRAFT`; после первого documentation push GitHub сообщал `mergeable=true`, а проверки пересчитывались (`mergeable_state=unstable`). Base — `main`, head — recovery-ветка.
- Production не изменялся в рамках документирования.

## Что подтверждено для PR #3

- Восстановленный production backend находится в `server/production/`.
- `Dockerfile.backend` находится в корне репозитория и фиксирует воспроизводимую сборку `linux/amd64`.
- Backend unit tests: **12/12 passed** согласно описанию PR #3.
- PostgreSQL integration test в `POSTGRES_TEST_MODE=local` был успешно выполнен согласно описанию PR #3: migrations, one-time owner bootstrap, RLS/tenant isolation, cross-tenant FK denial, operation idempotency и viewer write denial.
- Docker-образ из текущего `Dockerfile.backend` ещё не был реально собран и проверен полным HTTP-flow.

## Текущий блокер и следующий шаг

Единственный зафиксированный gate перед готовностью PR #3 к merge:

1. На developer machine или CI с рабочим Docker Engine и registry egress собрать образ `linux/amd64`.
2. Запустить Docker-mode `npm run test:db` против собранного образа.
3. Получить успешный flow: `/ready` → login → organizations → logout → повторный запрос возвращает `401`.
4. Записать дату, окружение, image tag и результат в новый checkpoint и обновить PR #3.

Точные команды находятся в `RUNBOOK.md`.

## Запреты до закрытия gate

- Не rebuild/recreate production container из PR #3.
- Не выполнять тесты в production directory на Hetzner.
- Не деплоить и не менять DNS, Caddy, UFW, PostgreSQL production data или secrets.
- Не переводить PR из draft и не merge до подтверждённого Docker gate и отдельного решения о rollout.

## Правило checkpoint-before-stop

Перед любой паузой, передачей работы или завершением сессии необходимо:

1. сверить GitHub и рабочее дерево;
2. обновить `PROJECT_STATE.md`, если изменился текущий статус;
3. создать новый датированный checkpoint с фактами, командами проверки, блокерами и одним следующим шагом;
4. не записывать секреты;
5. закоммитить checkpoint вместе с относящимися к нему изменениями или явно отметить, почему он не закоммичен.

Никакая ключевая техническая информация не должна существовать только в чате.
