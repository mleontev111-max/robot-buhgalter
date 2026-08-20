#!/usr/bin/env python3
"""Генератор чекпоинтов проекта Robot-Buhgalter."""

import argparse
import os
import subprocess
from datetime import datetime
from pathlib import Path


def run_git_command(cmd: str) -> str:
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return "N/A"


def get_git_info() -> dict[str, str]:
    return {
        "branch": run_git_command("git branch --show-current"),
        "last_commit": run_git_command("git log -1 --format='%h - %s (%ar)'"),
        "commit_hash": run_git_command("git rev-parse --short HEAD"),
        "author": run_git_command("git config user.name"),
        "uncommitted": run_git_command("git status --short"),
    }


def create_checkpoint(project_name: str, stage: str, author: str, notes: str = "") -> Path:
    git = get_git_info()
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M")
    date_readable = datetime.now().strftime("%Y-%m-%d %H:%M")
    branch = (git["branch"] or "unknown").replace("/", "_")

    checkpoint_dir = Path("checkpoints")
    checkpoint_dir.mkdir(exist_ok=True)
    filepath = checkpoint_dir / f"checkpoint_{timestamp}_{branch}.md"

    content = f"""# 🚀 ЧЕКПОИНТ: {project_name}

## 📌 Мета-информация
- **Дата:** {date_readable}
- **Автор:** {author}
- **Ветка:** `{git['branch']}`
- **Commit:** `{git['commit_hash']}`
- **Последний коммит:** {git['last_commit']}

---

## 🗺️ Текущий этап: {stage}

### ✅ Что сделано
- [ ] Заполнить фактически выполненные задачи

### 🔄 В работе (WIP)
1. **[НАЗВАНИЕ ЗАДАЧИ]** — [описание]
   - **Статус:** [0-100%]
   - **Блокеры:** [если есть]
   - **Следующий шаг:** [что делать дальше]

### 📋 Бэклог
| Приоритет | Задача | Кто | ETA |
|-----------|--------|-----|-----|
| P0 | [Следующая задача] | [Кто] | [Когда] |
| P1 | [Задача после] | [Кто] | [Когда] |

---

## 🧠 Контекст
{notes if notes else '_Добавьте архитектурные решения и важные факты_'}

### Ключевые файлы
```bash
src/main.tsx
src/pages/Home.tsx
src/lib/tax.ts
src/lib/organizationTax.ts
src/lib/taxCalendar.ts
src/lib/storage.ts
src/types/index.ts
src/types/domain.ts
```

### Незакоммиченные изменения
```bash
{git['uncommitted'] if git['uncommitted'] else 'Нет незакоммиченных изменений'}
```

---

## ⚠️ Риски и блокеры
- [ ] Опишите текущие проблемы

---

## 🔄 Быстрое восстановление
```bash
git branch --show-current
git log --oneline -5
git status
npm install
npm run typecheck
npm run dev
```

---
*Следующий чекпоинт: при завершении этапа или перед длительной паузой*
*Файл создан автоматически checkpoint.py*
"""
    filepath.write_text(content, encoding="utf-8")
    print(f"✅ Чекпоинт создан: {filepath}")
    print("Следующий шаг: заполните WIP/бэклог и закоммитьте каталог checkpoints/.")
    return filepath


def main() -> None:
    parser = argparse.ArgumentParser(description="Генератор чекпоинтов проекта")
    parser.add_argument("--project", "-p", default="Robot-Buhgalter", help="Название проекта")
    parser.add_argument("--stage", "-s", default="MVP / интеграции", help="Текущий этап")
    parser.add_argument("--author", "-a", default="GPT+Dev", help="Кто создаёт чекпоинт")
    parser.add_argument("--notes", "-n", default="", help="Дополнительные заметки")
    args = parser.parse_args()

    if not os.path.exists(".git"):
        print("⚠️ Не найден git-репозиторий. Git-информация будет N/A.")

    create_checkpoint(args.project, args.stage, args.author, args.notes)


if __name__ == "__main__":
    main()
