# 🚀 ЧЕКПОИНТ: Robot-Buhgalter

## 📌 Мета-информация
- **Дата:** 2026-08-28 07:05 (UTC+3)
- **Автор:** Claude Sonnet 5 (сессия `claude/github-connection-q4t7zr`)
- **Ветка:** `claude/github-connection-q4t7zr`
- **Commit:** `0f142ab`
- **Этап:** стабилизация MVP — технический аудит закрывается пункт за пунктом

Это независимая сессия поверх работы «GPT-5.6 Sol + Михаил» (чекпоинты
`checkpoint_2026-08-25_*`). Веду тот же список рисков, ничего не дублирую.

---

## 🗺️ Где мы находимся

### ✅ Что сделано в этой сессии (после 25.08), в своей ветке

1. **Доступ к GitHub восстановлен.** Push сначала падал с 403 (GitHub App не
   была авторизована на аккаунте); после `Install & Authorize` в connectors
   заработало.

2. **Prettier** (`ac64fa5`) — отформатирован весь `src/**` (кроме
   `components/ui/**`) и `server/**`. `format:check` в оба workflow.

3. **Налоговые правила по годам** (`ec563d7`) — `TAX_2026` заменён на реестр
   `TAX_RULES_BY_YEAR` + `resolveTaxRules(year)`. Для года без правил — честное
   предупреждение вместо тихой ошибки. Починен реальный баг:
   `quarterlyAdvances` не прокидывал `year` в `calcTax`. Тесты 14 → 19.

4. **Шифрование API-ключей в localStorage** (`c6792b8`) — PBKDF2 → AES-GCM 256
   через WebCrypto, опционально, пароль нигде не хранится. Тесты 19 → 28.

5. **Тесты на `taxCalendar.ts`** (`9769918`) — статусы по срокам, погашение
   платежом, накопительные авансы УСН (числа посчитаны руками), патент,
   сортировка, сводка. Тесты 28 → 45.

6. **Code-splitting** (`a2ad4b1`) — `React.lazy()` на все 6 разделов +
   `Suspense`, `xlsx` — динамический импорт. Закрыл варнинг Vite про чанк
   >500 KB (было 823 KB, стало 312 KB стартовый чанк). Реально прогнал в
   браузере (`npm run dev` + Playwright), не только `vite build`.

7. **Расследование `legalForm`-гейта в `taxCalendar.ts`, закрыто как false
   positive** (`72fb021`) — пользователь попросил рекомендацию, не команду
   чинить. Проверил глубже: `organization.legalForm` задаётся один раз при
   создании и никогда не редактируется; `store.legalForm` — то, что
   пользователь реально меняет в Настройках и что уже управляет расчётом
   ОСНО в `tax.ts`. «Починка» на `organization.legalForm` была бы регрессом.
   Код не менялся, поправлен только вводящий в заблуждение комментарий в
   тесте.

### Проверено перед каждым коммитом в своей ветке
`tsc -b --noEmit`, `eslint .`, `prettier --check .`, `vitest run`, `vite build` —
все пять зелёные перед каждым коммитом. CI на реальном GitHub Actions не
запускался ни разу за сессию (нет PR из этой ветки) — все проверки локальные.

### 8. Production backend на Hetzner — расследование, потом помощь в PR #3

Пользователь и коллега (не эта сессия) провели раскопки на живом Hetzner-
контейнере `robot-buhgalter-api-1` и выяснили: реальный продакшен-код
(`app.mjs`, `db.mjs`, `auth.mjs`, `tenancy.mjs`, `security.mjs`, SQL-миграции,
`pg`-клиент к `project2-postgres`) **не совпадал с GitHub** — жил только на
сервере. Восстановили из бэкапа контейнера, открыли **draft PR #3**
(`recovery/production-backend-2026-08-27`). Всё это — отдельная ветка,
**никаких изменений в `main` или в моей `claude/github-connection-q4t7zr`**.

- **Проверял сам, не принимал на слово.** По ходу расследования поймал два
  неверных утверждения из чужих сообщений: что `robot-buhgalter` «не в
  списке репозиториев» (был, первым пунктом) и что архитектура уже
  сохранена в `SERVER_MAP.md`/`RUNBOOK.md`/`SERVER_CHANGELOG.md`/
  `ROBOT_BUHGALTER_PRODUCTION.md` (этих файлов нет нигде в `git log --all`).
  Указал на оба прямо, не промолчал.
- **Блокер 1 закрыт** (`706f06b`): добавил `vitest ^4.1.11` +
  `server/production/vitest.config.mjs` (без него Vitest подхватывал
  корневой `vite.config.ts` фронтенда и падал). `npm test` → 12/12.
- **Блокер 2 начат, закрыт частично** (`bee7919`):
  - `Dockerfile.backend` (корень репо) + `server/production/docker-entrypoint.sh`
    — по фактам, снятым с живого образа (`docker inspect`/`docker history`):
    linux/amd64, Alpine 3.23.4, Node v20.20.2, WORKDIR /app, ENTRYPOINT
    `docker-entrypoint.sh`, CMD `node server/production/index.mjs`, EXPOSE
    8788, non-root `app:app`. `npm ci --omit=dev` вместо копирования готового
    `node_modules` (как было в старом образе).
  - Добавил в `package.json` скрипты `db:migrate`/`server:production`/
    `auth:bootstrap`/`test:db` — README их документировал, а их не было.
  - Поправил `db.integration.mjs`: два пути (`migrate.mjs`,
    `app-role-grants.sql`) были захардкожены относительно CWD=корень репо,
    из-за чего `npm run test:db` изнутри `server/production/` резолвил бы их
    неверно. Сделал self-relative, как уже сделано в `migrate.mjs`.
  - **Реально прогнал, не только написал**: `node --check` на всех `.mjs`,
    `npm test` (12/12), `npm audit` (0 уязвимостей), и
    `POSTGRES_TEST_MODE=local npm run test:db` — поднял настоящий PostgreSQL 16
    (пакет `postgresql-16` уже стоял в системе; `initdb` не пускает под root,
    гонял от системного пользователя `postgres`) — миграции применяются
    идемпотентно (дважды подряд), bootstrap владельца работает и отклоняет
    повтор, RLS блокирует чужой тенант, cross-tenant FK и дубликат
    `external_operation_id` отклоняются, запись viewer-роли отклоняется RLS.
  - **Честно НЕ выполнено — Docker-образ собрать физически не смог**:
    egress-политика этой песочницы блокирует `production.cloudfront.docker.com`
    (Docker Hub CDN) — подтверждено статусом agent-прокси (403, `policy
    denial`, не временный сбой). Инструкция самого прокси прямо говорит не
    обходить блокировку, а сообщать — так и сделал, не пытался найти
    зеркало/VPN/etc. Из-за этого: образ не собран, Docker-ветка
    `db.integration.mjs` (реальный HTTP-флоу login→organizations→logout→401
    через живой `/ready`) не прогонялась, точный собранный тег не
    зафиксирован. Нужна машина с реальным доступом к Docker Hub — Mac,
    CI или сам Hetzner.
  - Оставил два подробных комментария на PR #3 с честной разбивкой
    выполнено/не выполнено. PR остаётся draft.

### 🔄 В работе прямо сейчас
Ничего не в процессе. Моя ветка `claude/github-connection-q4t7zr` = `main` +
7 коммитов (последний `0f142ab`). PR #3 (recovery backend, отдельная ветка,
открыт пользователем) — я туда закоммитил 2 фикса (`706f06b`, `bee7919`),
жду от пользователя прогон Docker-сборки на машине с доступом к интернету.

---

## 🎯 Ближайшие шаги (актуальный бэклог из аудита)

| Приоритет | Задача | Статус |
|---|---|---|
| P0 | Данные операций/магазинов вынести из browser localStorage в backend | Не начато — своей ветки касается, PR #3 отдельная линия работы |
| P0 | ~~API-ключи маркетплейсов хранятся в открытом виде~~ | ✅ Закрыто опционально (шифрование по паролю) |
| P1 | Production sync backend вместо `localhost:8787` | Возможно закрывается через PR #3 (Hetzner API), но там ещё блокер 2 не завершён |
| — | ~~Гейт «взносы только для ИП» store vs. organization.legalForm~~ | ✅ Расследовано, false positive |
| — | ~~Code-splitting~~ | ✅ Закрыто |
| PR #3 | Собрать `Dockerfile.backend` на машине с доступом к Docker Hub, прогнать docker-часть `test:db`, зафиксировать SHA-tagged образ | Заблокировано egress-политикой этой песочницы — нужен пользователь/коллега |
| P2 | Открыть PR из `claude/github-connection-q4t7zr` в `main` | По запросу |
| P2 | Удалить мёртвые ветки `feature/tax-2026`, `architecture/multi-tenant-domain-model` | Заблокировано разрешениями сессии на `git push --delete` |

---

## 🧠 Контекст и архитектурные решения

- Реестр `TAX_RULES_BY_YEAR` — инфраструктура, не данные на будущее.
- Шифрование ключей — опциональное, не форсируется на существующих пользователей.
- Ветки `feature/tax-2026`/`architecture/multi-tenant-domain-model` — мусор от
  уже смёрженных 19.08 PR #1/#2, не чья-то параллельная работа.
- **PR #3 (`recovery/production-backend-2026-08-27`) — реальная, важная линия
  работы**, независимая от моей ветки. Там живёт настоящий multi-tenant
  backend с Postgres/RLS/auth, который уже частично работает на Hetzner.
  Моя ветка (`claude/github-connection-q4t7zr`) пока улучшает старый
  client-only MVP (localStorage) — эти две линии рано или поздно нужно будет
  свести, но не сейчас, не молча.
- Работа ведётся минимум тремя сторонами (эта сессия + «GPT-5.6 Sol» +
  пользователь/коллега напрямую на Hetzner и в PR #3) — сверяться с
  `git log --all`, `checkpoints/*.md` и открытыми PR перед началом работы,
  не только с локальным контекстом.
- **Docker Hub (`production.cloudfront.docker.com`) недоступен из этой
  песочницы** — egress-политика блокирует явно, не временный сбой. Любая
  задача, требующая `docker build`/`docker pull` внешнего образа, здесь
  физически невыполнима; нужна другая машина.

### Ключевые файлы (моя ветка)
```bash
src/lib/tax.ts
src/lib/organizationTax.ts
src/lib/secretCrypto.ts
src/lib/storage.ts
src/sections/Connections.tsx
src/types/index.ts
server/index.mjs
```

### Ключевые файлы (PR #3, ветка recovery/production-backend-2026-08-27)
```bash
Dockerfile.backend
server/production/docker-entrypoint.sh
server/production/app.mjs
server/production/db.mjs
server/production/db.integration.mjs
server/production/auth.mjs
server/production/security.mjs
server/production/tenancy.mjs
server/production/migrations/*.sql
```

### Незакоммиченные изменения
```bash
Нет незакоммиченных изменений
```

---

## ⚠️ Риски и блокеры

| Проблема | Уровень | Действие |
|---|---|---|
| Бухгалтерские данные (операции/магазины) только в localStorage в client-only MVP | 🔴 Высокий | Возможно решается через PR #3 backend, когда он дойдёт до продакшена |
| Docker Hub заблокирован egress-политикой этой песочницы | 🟠 Важный | Собрать образ на другой машине — Mac/CI/Hetzner |
| PR #3 blocker 2 не завершён: образ не собран, docker-часть интеграционного теста не прогнана | 🟠 Важный | Ждёт пользователя/коллегу с доступом к Docker Hub |
| Шифрование API-ключей опционально, не форсируется | 🟡 Средний | Сознательный компромисс UX vs. защита |
| `localhost:8787` sync-сервер (моя ветка) vs. публичный HTTPS-сайт | 🟠 Важный | Возможно устарело — PR #3 предлагает другой backend (Hetzner+Postgres) |
| «Мои организации» (`Organizations.tsx`, моя ветка) — нельзя редактировать/удалить существующую | 🟢 Низкий | Не блокирует текущий функционал |
| Мёртвые ветки на GitHub засоряют список | 🟢 Низкий | Удалить вручную |

---

## 💬 Последнее обсуждение
> **Пользователь** попросил план по production backend на Hetzner, затем сам
> предоставил результаты собственного расследования (образ, порты, Postgres,
> код в контейнере). Я перепроверял каждое существенное утверждение сам,
> прежде чем на него полагаться — поймал две неточности в переданной
> информации, указал прямо. Закрыл блокер 1 PR #3 полностью, блокер 2 —
> частично (весь код готов и синтаксически/юнит-тестами проверен, но саму
> Docker-сборку в этой песочнице выполнить невозможно — egress-блокировка,
> не моя ошибка и не то, что можно обойти).

---

## 🔄 Как восстановить работу
1. `git log --oneline -10` на `claude/github-connection-q4t7zr` — голова
   `0f142ab`. Отдельно проверить `origin/recovery/production-backend-2026-08-27`
   (сейчас `bee7919`) и состояние PR #3 — жив ли ещё, что ответил пользователь.
2. Свериться с `checkpoints/checkpoint_2026-08-25_14-00_main.md`.
3. В своей ветке: `npm install && npx tsc -b --noEmit && npm run lint &&
   npm run format:check && npm test && npm run build` — все пять зелёные
   перед новым коммитом.
4. Если пользователь прислал вывод Docker-сборки с другой машины — разобрать,
   сравнить с ожиданиями из `Dockerfile.backend`, закрыть blocker 2 в PR #3.
5. Иначе — дальше по бэклогу своей ветки: P1 production sync backend или P0
   вынос данных, оба требуют решения пользователя по хостингу (не начинать
   молча), либо явно обсудить, не пора ли свести client-only MVP и PR #3
   backend в одну архитектуру.

---
*Следующий чекпоинт: после следующего содержательного шага или перед паузой.*
