# Задание: «Робот-бухгалтер» на домашнем сервере (iMac, Ubuntu) и уборка остатков

Адресат: системный администратор / серверный специалист.
Версия 2, 2026-10-13. Заменяет версию 1 (macOS/brew/launchd), которая к этому
серверу неприменима.
Репозиторий: `https://github.com/mleontev111-max/robot-buhgalter`

## Исходное состояние (по описи специалиста от 2026-10-13)

**iMac `192.168.1.80`** (Apple iMac12,2, Ubuntu 24.04.3, hostname `thechai-node-01`):

- работает compose-стек `/srv/thechai/apps/ops-stack`, в нём общий
  `project2-postgres` (данные в `/srv/thechai/apps/ops-stack/postgres-data`);
- в этом же стеке контейнер `robot-buhgalter-api` (`127.0.0.1:8788`, образ
  `robot-buhgalter-api:20260825-1636-bootstrap-fix`, база `robot_buhgalter`,
  `users` = 0, `organizations` = 0);
- `127.0.0.1:8787` занят `thechai-master-catalog-review`;
- порты `80`, `443`, `8790` свободны; веб-сервера нет; Avahi нет;
- второй адрес по Wi-Fi `192.168.1.69`.

**Hetzner `ai-vpn`**: контейнера робота, `project2-postgres` и
`/opt/apps/robot-buhgalter` нет. Остался только cron
`/etc/cron.d/robot-buhgalter-backup`, который ссылается на удалённый каталог.

**Данных для переноса нет**: реальный учёт не вёлся (резервная копия браузера
содержит только встроенный демо-набор, в базе робота 0 записей).

## Решения владельца

- Приложение работает на iMac. Доступ только из домашней сети.
- Серверный бэкенд `robot-buhgalter-api` (PR #3) не используется: фронтенд его не
  вызывает. Он удаляется с iMac, код остаётся в GitHub как архив.
- Сайт kolyman.ru (GitHub Pages) выключается.

## Этапы

| Этап | Что | Кто |
|---|---|---|
| 1 | Поднять фронтенд и сервер синхронизации на iMac | специалист |
| 2 | Убрать `robot-buhgalter-api` и его базу с iMac | специалист, после приёмки этапа 1 |
| 3 | Убрать остаток на Hetzner (cron) | специалист |
| 4 | Выключить kolyman.ru, закрыть PR #3, обновить документацию | владелец / Claude |

Общие правила для всех этапов:

- Не трогать сервисы thechai, `thechai-master-catalog-review`, порт `8787`,
  `project2-postgres` как контейнер, его данные и чужие базы в нём.
- Не перезапускать весь `ops-stack` (`docker compose up -d`, `down`, `restart`
  без имени сервиса запрещены).
- Не выводить в терминал, лог или чат содержимое `.env`, пароли, `DATABASE_URL`.
- Перед каждым удалением: что именно удаляется, присылается владельцу, и
  удаление идёт только после его «да».

---

# Этап 1. Фронтенд и сервер синхронизации на iMac

## 1.1. Схема

```
Mac mini (браузер)
   │  https://192.168.1.80
   ▼
Caddy :443 (iMac)
   ├── /        → статика /srv/robot-buhgalter/app/dist
   └── /sync/*  → 127.0.0.1:8790  (server/index.mjs, systemd)
```

Адрес: `https://192.168.1.80`. Имя `.local` не используем: Avahi на сервере нет, и
ставить его ради этого не нужно. Wi-Fi-адрес `192.168.1.69` не используем:
сертификат и `ALLOWED_ORIGINS` будут выписаны только на `192.168.1.80`.

HTTPS обязателен: шифрование ключей в браузере (WebCrypto) работает только в
secure context, а страница по HTTPS не может ходить к серверу по HTTP (mixed
content).

## 1.2. Подготовка

```bash
ssh mikhail@192.168.1.80
node --version 2>/dev/null; which node
sudo ufw status verbose
```

`192.168.1.80` должен быть закреплён за Ethernet-портом iMac резервированием DHCP
на роутере. Если не закреплён, сделать это и сообщить.

Node.js 20. Если в системе уже есть Node 20+ и он используется сервисами thechai,
не переустанавливать и не обновлять его, а использовать как есть. Если Node нет
или версия ниже 20, поставить отдельно, не трогая системный:

```bash
# вариант без влияния на thechai: отдельная копия Node только для робота
sudo mkdir -p /srv/robot-buhgalter
cd /tmp
curl -fsSLO https://nodejs.org/dist/v20.20.2/node-v20.20.2-linux-x64.tar.xz
curl -fsSL https://nodejs.org/dist/v20.20.2/SHASUMS256.txt | grep node-v20.20.2-linux-x64.tar.xz | sha256sum -c -
sudo tar -xJf node-v20.20.2-linux-x64.tar.xz -C /srv/robot-buhgalter
sudo ln -sfn /srv/robot-buhgalter/node-v20.20.2-linux-x64 /srv/robot-buhgalter/node
/srv/robot-buhgalter/node/bin/node --version
```

Дальше `NODE=/srv/robot-buhgalter/node/bin` (или каталог уже установленного
Node 20, если он есть).

## 1.3. Пользователь и код

Отдельный системный пользователь, без входа в систему:

```bash
sudo useradd --system --home /srv/robot-buhgalter --shell /usr/sbin/nologin robot-sync
sudo chown robot-sync:robot-sync /srv/robot-buhgalter
sudo -u robot-sync git clone https://github.com/mleontev111-max/robot-buhgalter.git /srv/robot-buhgalter/app
cd /srv/robot-buhgalter/app
sudo -u robot-sync git checkout claude/github-connection-q4t7zr
```

Ветка `claude/github-connection-q4t7zr`: только в ней адрес сервера синхронизации
задаётся при сборке. В `main` он зашит как `http://localhost:8787`. Когда владелец
вольёт ветку в `main`, один раз выполнить
`sudo -u robot-sync git checkout main && sudo -u robot-sync git pull`.

## 1.4. Сборка

```bash
cd /srv/robot-buhgalter/app
export PATH=$NODE:$PATH
sudo -u robot-sync env PATH=$PATH npm ci
sudo -u robot-sync env PATH=$PATH npm test
sudo -u robot-sync env PATH=$PATH VITE_SYNC_SERVER_URL=https://192.168.1.80/sync npm run build
ls dist/index.html
```

iMac 2011 года: сборка может занять несколько минут, это нормально.

## 1.5. Сервер синхронизации (systemd, порт 8790)

`/etc/systemd/system/robot-buhgalter-sync.service`:

```ini
[Unit]
Description=Robot-Buhgalter marketplace sync proxy
After=network-online.target
Wants=network-online.target

[Service]
User=robot-sync
Group=robot-sync
WorkingDirectory=/srv/robot-buhgalter/app
Environment=PORT=8790
Environment=HOST=127.0.0.1
Environment=ALLOWED_ORIGINS=https://192.168.1.80
ExecStart=/srv/robot-buhgalter/node/bin/node server/index.mjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ReadOnlyPaths=/srv/robot-buhgalter

[Install]
WantedBy=multi-user.target
```

Если используется уже установленный Node, поправить путь в `ExecStart`.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now robot-buhgalter-sync
systemctl status robot-buhgalter-sync --no-pager
curl -sS http://127.0.0.1:8790/api/health
sudo ss -ltnp | grep -E ':8787|:8790'
```

Ожидается `{"ok":true,"service":"robot-buhgalter-sync"}`; `8790` слушается только
на `127.0.0.1`; `8787` по-прежнему принадлежит каталогу чая.

`ALLOWED_ORIGINS` должен совпадать с адресом страницы символ в символ, без слэша
в конце.

## 1.6. Caddy (HTTPS на 192.168.1.80)

```bash
sudo apt update
sudo apt install -y caddy
caddy version
```

`/etc/caddy/Caddyfile` (пакет кладёт туда пример, заменить целиком; других сайтов
в нём нет, так как веб-сервера на iMac не было):

```caddy
{
    # Внутренний CA, сертификат на IP. Без обращений к Let's Encrypt.
    local_certs
}

https://192.168.1.80 {
    tls internal
    encode gzip

    handle_path /sync/* {
        reverse_proxy 127.0.0.1:8790
    }

    handle {
        root * /srv/robot-buhgalter/app/dist
        try_files {path} /index.html
        file_server
    }
}

http://192.168.1.80 {
    redir https://192.168.1.80{uri} permanent
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy || sudo systemctl restart caddy
sudo systemctl enable caddy
curl -sk https://192.168.1.80/sync/api/health
```

Файрвол. Если `ufw` активен, открыть 80/443 только для домашней сети:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 80,443 proto tcp
```

Порт `8790` не открывать. Проброс портов на роутере не настраивать.

## 1.7. Сертификат на Mac mini

На iMac корневой сертификат Caddy лежит здесь:

```bash
sudo ls /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt
sudo cp /var/lib/caddy/.local/share/caddy/pki/authorities/local/root.crt /tmp/robot-root.crt
sudo chmod 644 /tmp/robot-root.crt
```

На Mac mini:

```bash
scp mikhail@192.168.1.80:/tmp/robot-root.crt ~/Downloads/
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain ~/Downloads/robot-root.crt
```

Затем на iMac `sudo rm /tmp/robot-root.crt`, на Mac mini перезапустить браузер.
Копировать только `root.crt`; файл `root.key` никуда не копировать.

## 1.8. Обновление

```bash
cd /srv/robot-buhgalter/app
export PATH=/srv/robot-buhgalter/node/bin:$PATH
sudo -u robot-sync git pull
sudo -u robot-sync env PATH=$PATH npm ci
sudo -u robot-sync env PATH=$PATH npm test
sudo -u robot-sync env PATH=$PATH VITE_SYNC_SERVER_URL=https://192.168.1.80/sync npm run build
sudo systemctl restart robot-buhgalter-sync
```

## 1.9. Приёмка этапа 1 (проверять с Mac mini)

1. `https://192.168.1.80` открывается без предупреждения о сертификате,
   приложение отрисовано, в консоли браузера нет ошибок.
2. `https://192.168.1.80/sync/api/health` отдаёт
   `{"ok":true,"service":"robot-buhgalter-sync"}`.
3. На странице «Подключения» сервер синхронизации «доступен».
4. В консоли нет ошибок CORS и mixed content.
5. Проверка одного реального read-only ключа проходит.
6. Синхронизация за `01.01.2026 – 30.09.2026` по одному кабинету возвращает
   непустой список операций.
7. Шифрование ключей паролем включается без ошибок.
8. `nc -vz 192.168.1.80 8790` и `nc -vz 192.168.1.80 8788` с Mac mini
   завершаются отказом.
9. Каталог чая на `8787` работает так же, как до начала работ.
10. После `sudo reboot` iMac приложение и `/sync/api/health` снова доступны без
    ручных действий.
11. Обновление по п. 1.8 выполнено хотя бы один раз.

Отчёт: результат по 11 пунктам, какой Node использован (свой или существующий),
был ли активен `ufw`. **Дальше только после подтверждения владельца.**

---

# Этап 2. Удаление `robot-buhgalter-api` с iMac

Контейнер не нужен: фронтенд его не вызывает, в базе 0 пользователей и 0
организаций. Удаляется только сервис робота и его база. Стек `ops-stack`,
контейнер `project2-postgres` и остальные базы остаются.

## 2.1. Опись (ничего не менять)

```bash
cd /srv/thechai/apps/ops-stack
ls -la
docker compose config --services
grep -n -i robot compose*.y*ml docker-compose*.y*ml 2>/dev/null
ls -la | grep -i -E 'robot|\.env'
docker exec project2-postgres psql -U postgres -c '\l'
docker exec project2-postgres psql -U postgres -c '\du'
docker exec project2-postgres psql -U postgres -d robot_buhgalter -c '\dt'
```

Если суперпользователь не `postgres`, взять имя из конфигурации стека, не меняя
её.

Прислать владельцу: имя сервиса робота в compose, какие строки compose-файла к
нему относятся, есть ли отдельный env-файл робота, список ролей, которые
принадлежат роботу (обычно `robot_buhgalter*`), и подтверждение, что эти роли
не владеют объектами в других базах:

```bash
for db in $(docker exec project2-postgres psql -U postgres -Atc "select datname from pg_database where not datistemplate and datname <> 'robot_buhgalter'"); do
  echo "== $db"; docker exec project2-postgres psql -U postgres -d "$db" -Atc \
  "select count(*) from pg_class c join pg_roles r on r.oid=c.relowner where r.rolname like 'robot%'"
done
```

Везде должно быть `0`. Если нет, остановиться и сообщить.

## 2.2. Резервная копия

```bash
TS=$(date +%Y%m%d-%H%M)
mkdir -p ~/robot-archive-$TS
cd /srv/thechai/apps/ops-stack
cp -a compose*.y*ml docker-compose*.y*ml ~/robot-archive-$TS/ 2>/dev/null
docker exec project2-postgres pg_dump -U postgres -Fc robot_buhgalter > ~/robot-archive-$TS/robot_buhgalter.dump
docker exec project2-postgres pg_dumpall -U postgres --roles-only > ~/robot-archive-$TS/roles.sql
ls -lh ~/robot-archive-$TS
```

Если у робота есть отдельный env-файл, скопировать его туда же. Архив содержит
секреты: передать владельцу по `scp` в зашифрованное место, после этого удалить с
сервера. Хранить 3 месяца.

## 2.3. Удаление (после «да» владельца по описи)

Остановить и удалить только сервис робота (имя из описи):

```bash
cd /srv/thechai/apps/ops-stack
docker compose stop <СЕРВИС_РОБОТА>
docker compose rm -f <СЕРВИС_РОБОТА>
```

Убрать блок сервиса робота из compose-файла (и его env-файл, если он отдельный),
иначе следующий `docker compose up -d` поднимет робота снова. Удалить из
`depends_on` других сервисов ссылки на робота, если они есть. Проверить:

```bash
docker compose config --quiet && echo OK
docker compose config --services
```

База и роли (имена из описи):

```bash
docker exec project2-postgres psql -U postgres -c 'DROP DATABASE robot_buhgalter;'
docker exec project2-postgres psql -U postgres -c 'DROP ROLE <РОЛЬ_1>;'
# повторить для каждой роли робота
```

Образ:

```bash
docker image rm robot-buhgalter-api:20260825-1636-bootstrap-fix
docker images | grep -i robot
```

Если на iMac есть cron или systemd-таймеры бэкапа робота
(`grep -ril robot /etc/cron* /etc/systemd/system`), показать владельцу и удалить
после подтверждения.

## 2.4. Приёмка этапа 2

1. `docker ps -a | grep robot-buhgalter-api` пусто; `ss -ltnp | grep 8788` пусто.
2. `docker compose config --services` в `ops-stack` не содержит робота, остальные
   сервисы на месте и в состоянии `running`/`healthy`.
3. `\l` и `\du` не показывают базу и роли робота; остальные базы на месте.
4. Каталог чая (`8787`) и остальные сервисы thechai работают.
5. Приложение на `https://192.168.1.80` работает (оно от этого контейнера не
   зависит).
6. Архив передан владельцу и удалён с сервера.

---

# Этап 3. Остаток на Hetzner

```bash
cat /etc/cron.d/robot-buhgalter-backup
sudo grep -rl -i robot /etc/cron.d /etc/cron.daily /etc/systemd/system 2>/dev/null
sudo find / -xdev \( -iname '*robot-buhgalter*' -o -iname '*robot_buhgalter*' \) 2>/dev/null | grep -v '^/proc'
```

Последняя команда ищет старые бэкапы робота (дампы, архивы), которые мог
оставить этот cron. Список прислать владельцу. После подтверждения:

```bash
sudo rm /etc/cron.d/robot-buhgalter-backup
# и найденные файлы робота по списку, согласованному с владельцем
```

Caddy на Hetzner не трогать: маршрута робота в нём нет.

---

# Этап 4. Выключение kolyman.ru и порядок в репозитории (владелец / Claude)

После приёмки этапов 2 и 3:

1. GitHub → репозиторий → Settings → Pages: снять публикацию.
2. Удалить из репозитория `CNAME` и `.github/workflows/deploy-pages.yml`.
3. У регистратора удалить DNS-записи `kolyman.ru`, указывающие на GitHub Pages.
   Домен остаётся за владельцем.
4. Убрать `https://kolyman.ru` и `https://www.kolyman.ru` из `defaultOrigins` в
   `server/index.mjs`.
5. Закрыть PR #3 без слияния; ветку `recovery/production-backend-2026-08-27` не
   удалять.
6. Обновить `README.md`, `AGENTS.md`, `PROJECT_STATUS.md`, `PROJECT_STATE.json`,
   `ACTIVE_WORK.json`, сделать checkpoint: приложение работает на iMac
   `192.168.1.80` (Ubuntu), Hetzner и серверный бэкенд не используются.

---

## Риски, которые остаются

- **Данные живут в браузере Mac mini.** Сломается Mac mini или очистятся данные
  сайта, и учёт пропадёт. Защита: экспорт «Настройки» → «Скачать безопасную
  копию» раз в неделю в папку, которая попадает в Time Machine или iCloud Drive.
- **Сертификат доверен только на Mac mini.** С телефона или другого компьютера
  приложение откроется с предупреждением, а шифрование ключей там работать не
  будет, пока на это устройство не установлен `root.crt`.
- **iMac 2011 года.** Если диск в нём механический и старый, его отказ уронит и
  каталог чая. Для робота это не потеря данных (они на Mac mini), но стоит
  проверить `smartctl -H` на диске iMac.
