# Робот-бухгалтер

Веб-приложение для расчёта и контроля налогов по продажам на маркетплейсах: Ozon, Wildberries, Яндекс Маркет и Авито.

**Публичный frontend-домен: `https://kolyman.ru`.** Файл `CNAME` в этом репозитории является канонической привязкой домена.

## Start here

Новый участник или AI-агент перед любой работой обязан прочитать:

1. [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — где проект находится сейчас и какой следующий шаг;
2. [`AGENTS.md`](AGENTS.md) — правила безопасной работы;
3. последний checkpoint из [`checkpoints/`](checkpoints/).

Если задача касается production backend, дополнительно прочитать draft PR #3 `Recovery: restore production backend from server backup`. Операционные подробности live-сервера и секреты намеренно не хранятся в публичном репозитории.

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

Production infrastructure details находятся в закрытой operational documentation, доступной только авторизованным участникам. Не переносить passwords, tokens, private keys, connection strings или другие секреты в этот публичный репозиторий.

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
npm run dev
```

Frontend локально запускается Vite (обычно `http://localhost:5173`).

Если нужен local read-only sync server, во втором терминале:

```bash
npm run server
```

Local sync server: `http://localhost:8787`.

> Для production-backend development не используйте этот local sync server как замену `server/production`. Следуйте `PROJECT_STATUS.md` и PR #3.

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
- не менять привязку `kolyman.ru` без явного решения владельца проекта.

## Current next action

**Закрыть воспроизводимость production backend через recovery PR #3:**

1. собрать test-only `linux/amd64` Docker image из PR #3;
2. не трогать текущий live image/container;
3. прогнать Docker-mode PostgreSQL/HTTP integration test;
4. проверить `/health`, `/ready`, login, organizations и logout/revoked-session behavior;
5. записать image tag, commit SHA и PASS/FAIL;
6. только после PASS решать перевод PR из draft и merge.

Подробное текущее состояние — в [`PROJECT_STATUS.md`](PROJECT_STATUS.md).
