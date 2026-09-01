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

## Production host access

- SSH user, последнее подтверждение 2026-08-25: `root`.
- Password authentication на дату проверки: disabled.
- Аутентификация: SSH key.
- Hostname/IP: хранить в private operational inventory; его утверждённое место **UNCONFIRMED/TODO**.
- Где находится действующий private SSH key: **UNCONFIRMED/TODO**.
- Где находится защищённая резервная копия private key: **UNCONFIRMED/TODO**.
- Кто имеет доступ к Hetzner account/console: **UNCONFIRMED/TODO**.
- Recovery: использовать Hetzner account/console и штатную процедуру замены authorized key; точный владелец аккаунта и процедура должны быть подтверждены до инцидента.

## Server-side secrets

Последнее подтверждение — 2026-08-25: runtime и migration configuration хранились раздельно server-side с доступом только root. Точные paths относятся к private operational documentation и не публикуются в repository.
- Значения секретов не фиксировались и не должны фиксироваться в Git, checkpoints, chat, shell history или frontend.
- Отдельное внешнее secret vault/backup для Robot-Buhgalter: **UNCONFIRMED/TODO**.
- Recovery владельца/migrator/app database credentials: **UNCONFIRMED/TODO**; требуется заранее утверждённая rotation procedure.
- Recovery `CREDENTIALS_ENCRYPTION_KEY`: **UNCONFIRMED/TODO**. Потеря ключа делает зашифрованные marketplace credentials невосстановимыми; компрометация требует их ротации.

## Обязательный preflight перед продолжением

Прочитать `PROJECT_STATE.md`, этот файл и последний checkpoint, затем сверить GitHub. Перед server access повторно подтвердить target host и выполнять read-only audit до любых изменений.
