# Карта доступа Robot-Buhgalter

## Политика

- Этот файл никогда не содержит passwords, private SSH keys, API keys, tokens, connection strings или значения `.env`.
- Разрешены только подтверждённые usernames, paths к защищённым хранилищам и процедуры восстановления.
- Если место хранения не подтверждено, используется `UNCONFIRMED/TODO`; догадки запрещены.

## GitHub

- Repository: `https://github.com/mleontev111-max/robot-buhgalter`.
- Owner/account: `mleontev111-max`.
- Метод локальной аутентификации GitHub: **UNCONFIRMED/TODO**.
- Место хранения GitHub credentials/token: **UNCONFIRMED/TODO**.
- Recovery: войти в GitHub под владельцем, восстановить доступ штатной процедурой GitHub, затем настроить `gh` или Git credential helper; секрет не копировать в этот файл.

## Developer Mac

- Канонический локальный путь к repository: **UNCONFIRMED/TODO**.
- Найденный 2026-08-30 checkout внутри временной/сессионной структуры Codex не считается утверждённым каноническим путём.
- macOS user, используемый для обычной разработки: **UNCONFIRMED/TODO**.
- Наличие и состояние Docker Desktop/Engine: **UNCONFIRMED/TODO**.

После однократного подтверждения записать сюда:

```text
Machine label: TODO
Repository path: TODO
Docker Engine verification date: TODO
```

## Hetzner SSH

- Hostname/IP, последнее подтверждение 2026-08-25: `ai-vpn` / `178.104.188.123`.
- SSH user, последнее подтверждение 2026-08-25: `root`.
- Password authentication на дату проверки: disabled.
- Аутентификация: SSH key.
- Где находится действующий private SSH key: **UNCONFIRMED/TODO**.
- Где находится защищённая резервная копия private key: **UNCONFIRMED/TODO**.
- Кто имеет доступ к Hetzner account/console: **UNCONFIRMED/TODO**.
- Recovery: использовать Hetzner account/console и штатную процедуру замены authorized key; точный владелец аккаунта и процедура должны быть подтверждены до инцидента.

## Server-side secrets

Последнее подтверждение путей — 2026-08-25:

- Runtime configuration: `/opt/apps/robot-buhgalter/.env` (`600 root:root` на дату проверки).
- Migration configuration: `/opt/apps/robot-buhgalter/.migrate.env` (`600 root:root` на дату проверки).
- PostgreSQL project2 secrets: `/opt/apps/project2/postgres/.env` (`600` на дату проверки); не относится к Robot-Buhgalter и не должен читаться/изменяться без отдельной необходимости.
- Значения секретов не фиксировались и не должны фиксироваться в Git, checkpoints, chat, shell history или frontend.
- Отдельное внешнее secret vault/backup для Robot-Buhgalter: **UNCONFIRMED/TODO**.
- Recovery владельца/migrator/app database credentials: **UNCONFIRMED/TODO**; требуется заранее утверждённая rotation procedure.
- Recovery `CREDENTIALS_ENCRYPTION_KEY`: **UNCONFIRMED/TODO**. Потеря ключа делает зашифрованные marketplace credentials невосстановимыми; компрометация требует их ротации.

## Обязательный preflight перед продолжением

Прочитать `PROJECT_STATE.md`, этот файл и последний checkpoint, затем сверить GitHub. Перед server access повторно подтвердить target host и выполнять read-only audit до любых изменений.
