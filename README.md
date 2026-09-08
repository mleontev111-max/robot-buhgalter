# Робот-бухгалтер

Веб-приложение для расчёта и контроля налогов по продажам на маркетплейсах: Ozon, Wildberries, Яндекс Маркет и Авито.

**Публичный frontend-домен: `https://kolyman.ru`.** Файл `CNAME` в этом репозитории является канонической привязкой домена.

## Start here

Для любого нового AI/helper-сеанса первым файлом является [`START_HERE_FOR_AI.md`](START_HERE_FOR_AI.md).

До любого ответа по проекту, выбора задачи, плана, code review, изменения кода, deployment-предложения или попытки повторить старую работу нужно пройти Resume Gate:

1. `PROJECT_STATE.json` — merged-main state;
2. `ACTIVE_WORK.json` — важная незамерженная работа в PR/ветках;
3. `CHECKPOINT_INDEX.json` — canonical checkpoint pointers;
4. `npm run resume` / `python3 tools/project_resume.py`;
5. соответствующий track/workstream current source.

`PROJECT_STATUS.md` остаётся стабильным описанием архитектуры, production reality, safety и verification, но не должен переопределять machine current-state layer.

Если задача касается production backend, дополнительно открыть текущий draft PR #3 `Recovery: restore production backend from server backup` и проверить его фактический HEAD непосредственно в GitHub. Не полагаться на SHA из старого текста или чата.

### Production operational source of truth

Для авторизованных участников канонические operational docs находятся в приватном репозитории `mleontev111-max/thechai_space`:

- `docs/server/ROBOT_BUHGALTER_PRODUCTION.md` — факты по Robot-Buhgalter production backend;
- `docs/server/SERVER_MAP.md` — текущая карта Hetzner/server infrastructure;
- `docs/server/RUNBOOK.md` — эксплуатационные/recovery процедуры.

Эти документы могут содержать только несекретные operational facts. Passwords, tokens, private keys, `.env`, database connection strings и другие секреты в Git не переносить.

## Архитектура сейчас

Важно различать два backend-контура.

### 1. Local / legacy sync server

`server/index.mjs` — простой read-only sync server для локальной разработки. Он запускается через:

```bash
npm run server
```

По умолчанию слушает `http://localhost:8787` и проксирует read-only запросы к API маркетплейсов. Это **не текущий production backend**.

### 2. Current production backend

Фактический production backend уже существует и использует PostgreSQL, authentication, tenant isolation и server-side encrypted marketplace credentials.

Его исходники были восстановлены из работающего production image и находятся в draft PR #3 в `server/production/`. PR ещё **не готов к merge/deploy**: до этого необходимо собрать test-only Docker image из Git и пройти Docker-mode HTTP/PostgreSQL integration gate.

## Что умеет frontend

- дашборд по выручке, расходам маркетплейсов и налогам;
- операции с фильтрами и ручным вводом;
- импорт CSV/XLSX;
- налоговые расчёты по организациям и режимам;
- налоговый календарь и журнал платежей;
- marketplace connections;
- резервный JSON-экспорт без API credentials.

Текущий `main` всё ещё использует browser `localStorage` для MVP-состояния. Это не следует путать с фактической production backend архитектурой, которая восстанавливается в PR #3.

## Clean local start для current main

Требуется Node.js 20 и npm.

```bash
git clone https://github.com/mleontev111-max/robot-buhgalter.git
cd robot-buhgalter
npm ci
npm run resume
npm run dev
```

Frontend локально запускается на:

```text
http://localhost:3000
```

Порт `3000` закреплён в `vite.config.ts` и является каноническим local frontend port.

Если нужен local read-only sync server, во втором терминале:

```bash
npm run server
```

Local sync server: `http://localhost:8787`.

Его default CORS разрешает `http://localhost:3000` и `http://127.0.0.1:3000`. При нестандартном origin задайте `ALLOWED_ORIGINS` явно.

> Для production-backend development не используйте этот local sync server как замену `server/production`. Следуйте machine resume state и текущему состоянию PR #3.

## Проверка

Перед завершением любой кодовой сессии:

```bash
npm test
npm run lint
npm run build
```

GitHub CI на `main` выполняет те же обязательные проверки. GitHub Pages deploy также зависит от успешных lint/tests/build.

## Marketplace API safety

Локальный sync server предназначен только для read-only операций. Ключи маркетплейсов не должны попадать в Git, checkpoints, issues, логи или backup exports.

Production credentials должны храниться только server-side в предусмотренном production backend контуре.

## Production safety

Пока recovery PR #3 не прошёл Docker parity gate:

- не rebuild и не заменять текущий live production backend;
- не считать `server/index.mjs` production backend;
- не merge PR #3 только на основании unit/local DB tests;
- не менять production database вручную;
- не менять DNS/Caddy/UFW в рамках recovery gate;
- не менять привязку `kolyman.ru` без явного решения владельца проекта.

## Current next action

Не определять следующий шаг из этого narrative-блока без Resume Gate. Canonical ONE NEXT ACTION находится в `PROJECT_STATE.json` и связанном current checkpoint/workstream state.

Стабильное архитектурное и production-описание — в [`PROJECT_STATUS.md`](PROJECT_STATUS.md).
