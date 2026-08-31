# Runbook Robot-Buhgalter

## 1. Начало каждой рабочей сессии

Из корня repository:

```bash
sed -n '1,240p' PROJECT_STATE.md
sed -n '1,240p' ACCESS_MAP.md
sed -n '1,240p' README.md
sed -n '1,240p' AGENTS.md
sed -n '1,240p' PROJECT_STATUS.md
latest_checkpoint="$(find checkpoints -maxdepth 1 -type f -name 'checkpoint_*.md' -print | sort | tail -1)"
test -n "$latest_checkpoint" && sed -n '1,280p' "$latest_checkpoint"
git status --short --branch
git remote -v
git fetch origin main recovery/production-backend-2026-08-27
git rev-parse origin/main
git rev-parse origin/recovery/production-backend-2026-08-27
```

Затем проверить PR #3 через GitHub UI или:

```bash
gh pr view 3 --repo mleontev111-max/robot-buhgalter \
  --json state,isDraft,mergeable,headRefName,headRefOid,baseRefName,baseRefOid,statusCheckRollup,url
```

Если `gh` не аутентифицирован, восстановить GitHub access штатно. Не вставлять token в документацию или команды, сохраняемые в history.

## 2. Найти repository на Mac

Канонический путь пока **UNCONFIRMED/TODO**. Не подставлять выдуманный путь.

Безопасный поиск:

```bash
find "$HOME" -maxdepth 5 -type d -name robot-buhgalter 2>/dev/null
```

Для каждого результата подтвердить remote:

```bash
git -C "/absolute/confirmed/path/robot-buhgalter" remote get-url origin
```

Только после подтверждения записать канонический абсолютный путь в `ACCESS_MAP.md`.

## 3. PR #3: обязательный Docker gate

### Preconditions

- Выполнять на developer machine или CI, не в production directory Hetzner.
- Docker Engine должен работать и иметь pull access.
- Рабочее дерево должно соответствовать точному commit recovery-ветки.
- Команды выполняются из **корня repository**.

### Checkout и контроль SHA

```bash
git fetch origin recovery/production-backend-2026-08-27
git switch recovery/production-backend-2026-08-27
git pull --ff-only origin recovery/production-backend-2026-08-27
git status --short --branch
git rev-parse HEAD
```

Если есть незакоммиченные изменения, не удалять и не перезаписывать их; остановиться и изолировать проверку в clean worktree.

### Unit tests

```bash
cd server/production
npm ci
npm test
cd ../..
```

### Build `linux/amd64`

```bash
IMAGE_TAG="robot-buhgalter-api:$(git rev-parse --short HEAD)"
docker build --platform linux/amd64 -f Dockerfile.backend -t "$IMAGE_TAG" .
```

### Docker-mode PostgreSQL + HTTP integration

```bash
cd server/production
ROBOT_BUHGALTER_TEST_IMAGE="$IMAGE_TAG" npm run test:db
cd ../..
```

Pass должен подтвердить тестируемым образом: PostgreSQL/migrations, `/ready`, `POST /auth/login`, `GET /v1/organizations`, `POST /v1/auth/logout`, затем `401` при повторном использовании revoked session.

### Зафиксировать результат

- Полный commit SHA.
- Image tag.
- Host/OS/CPU architecture и Docker version без идентификаторов/секретов.
- Результаты unit и integration tests.
- Дату/время и ссылку на CI run, если применимо.
- Новый checkpoint; обновление `PROJECT_STATE.md` и PR #3.

Не push image и не deploy без отдельного решения.

## 4. Read-only server verification

До любого будущего rollout сначала подтвердить target по private operational inventory и доступ по `ACCESS_MAP.md`. Пример диагностического минимума после входа:

```bash
hostname
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

Container name и loopback readiness URL брать только из подтверждённого private inventory. Не читать `.env` values и не выполнять `docker compose up`, restart, migration или database write в рамках read-only проверки.

## 5. Завершение работы

Выполнить правило `checkpoint-before-stop` из `PROJECT_STATE.md`. Минимум:

```bash
git status --short --branch
git log -1 --oneline
```

Checkpoint обязан содержать подтверждённые факты, незавершённое, риски и один точный следующий шаг.
