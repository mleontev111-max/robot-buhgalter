# 🚀 ЧЕКПОИНТ: Robot-Buhgalter — Project Ready v0

## 📌 Мета-информация

- **Дата:** 2026-08-31
- **Ветка:** `main`
- **Этап:** onboarding / recovery alignment
- **Тип изменения:** documentation-only

## ✅ Что зафиксировано

1. `kolyman.ru` подтверждён как канонический публичный frontend-домен Robot-Buhgalter.
2. В корне проекта добавлены `PROJECT_STATUS.md` и `AGENTS.md`.
3. `README.md` обновлён так, чтобы новый участник различал:
   - local/legacy read-only sync server `server/index.mjs`;
   - фактический production backend, восстановленный в draft PR #3 под `server/production/`.
4. Зафиксировано, что текущий `main` всё ещё содержит browser-localStorage MVP, а production runtime уже использует PostgreSQL/auth/tenant isolation/server-side encrypted credentials.
5. Зафиксирована граница публичного и приватного знания: production secrets и чувствительные operational details не должны переноситься в public repo.

## ✅ Последнее verified состояние до этого checkpoint

- `main`: `57f9ccfb7c9d95f65109511b66f31f7f00562f46`
- CI: success
- GitHub Pages deploy: success
- tax regression tests: green

Project Ready update не меняет application code, production Docker, PostgreSQL или server configuration.

## 🔄 Recovery PR #3

Draft PR #3 восстанавливает production backend из server backup.

Зафиксированный reviewed head:

`bee7919529ce86c4cdad9b2b1d9fbae2e2f1e963`

Уже подтверждено в PR:

- production source и migrations восстановлены;
- unit tests проходят;
- local PostgreSQL integration проходит;
- security/tenant isolation checks проходят;
- `Dockerfile.backend` восстановлен;
- dependency install сделан воспроизводимым через lockfile.

## 🚧 Главный blocker

Ещё не доказано, что production backend можно воспроизводимо собрать из Git в Docker image и получить runtime parity.

Поэтому **запрещено считать PR #3 deploy-ready только на основании source review/local tests**.

## 🎯 NEXT ACTION

Закрыть Docker parity gate для PR #3 без изменения live production:

1. собрать test-only `linux/amd64` Docker image из recovery branch;
2. текущий live Robot image/container не трогать;
3. запустить Docker-mode PostgreSQL/HTTP integration test против нового test image;
4. проверить `/health`, `/ready`, login, organizations, logout и revoked-session `401`;
5. записать точный commit SHA, image tag и `PASS/FAIL`;
6. только после `PASS` решать перевод PR #3 из draft и merge;
7. production rollout проводить отдельным milestone с rollback plan.

## ⚠️ Жёсткие правила

- не публиковать secrets в GitHub;
- не использовать `server/index.mjs` как production backend;
- не rebuild/remove/replace live production image до доказанной Git-backed reproducibility;
- не менять production PostgreSQL вручную;
- не менять `kolyman.ru` без явного решения владельца;
- старые checkpoints не переписывать.

## Следующий checkpoint

После реального Docker build + Docker-mode integration test PR #3 с зафиксированным PASS/FAIL.
