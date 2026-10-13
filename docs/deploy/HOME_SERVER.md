# Задание: перенести «Робота-бухгалтера» с Hetzner на iMac и убрать его с Hetzner

Адресат: системный администратор / серверный специалист.
Дата постановки: 2026-10-13.
Репозиторий: `https://github.com/mleontev111-max/robot-buhgalter`

Задание состоит из трёх этапов. Делать строго по порядку: этап 2 начинать только
после того, как владелец подтвердил приёмку этапа 1.

| Этап | Что | Кто |
|---|---|---|
| 1 | Поднять приложение на iMac | специалист |
| 2 | Удалить робота с Hetzner (`ai-vpn`), не задев остальное | специалист |
| 3 | Выключить kolyman.ru, закрыть PR #3, обновить документацию | владелец / Claude |

Переносить данные не нужно: реальный учёт в приложении ещё не вёлся
(проверено по резервной копии от 2026-10-13, в ней только встроенный демо-набор).

---

## Что именно сейчас работает и что переезжает

Приложение состоит из двух частей, обе из этого репозитория:

- **Frontend.** Статика, собирается в `dist/`. Все данные (организации, операции,
  ключи) хранятся в `localStorage` браузера пользователя, серверной базы нет.
- **Сервер синхронизации** `server/index.mjs`, Node, порт `8787`. Read-only прокси
  к API маркетплейсов. Ключи не хранит: они приходят в теле запроса.

На iMac переезжают обе части.

На Hetzner сейчас работает **другой** компонент: серверный бэкенд
`robot-buhgalter-api-1` (порт `127.0.0.1:8788`) с базой в PostgreSQL. Приложение
его не вызывает: фронтенд ходит только в сервер синхронизации. Владелец решил этот
бэкенд не переносить, а удалить. Его код остаётся в GitHub в ветке
`recovery/production-backend-2026-08-27`.

Чего на iMac не будет, чтобы не было неверных ожиданий:

- учётных записей и входа по паролю: кто открыл страницу, тот видит данные;
- фоновой синхронизации: она запускается вручную из интерфейса;
- хранения данных на iMac: данные живут в браузере Mac mini. Другое устройство
  увидит пустое приложение.

---

# Этап 1. iMac

## 1.1. Какую ветку брать

Собирать с ветки `claude/github-connection-q4t7zr`. В `main` адрес сервера
синхронизации жёстко зашит как `http://localhost:8787`, и с другого компьютера
приложение работать не будет. В этой ветке адрес задаётся переменной сборки
`VITE_SYNC_SERVER_URL`, сервер по умолчанию слушает только `127.0.0.1`.

Когда владелец вольёт эту ветку в `main`, на iMac нужно один раз выполнить
`git checkout main && git pull` и дальше обновляться с `main` (п. 1.7).

## 1.2. Подготовка iMac

```bash
ssh mikhail@192.168.1.80
uname -m                      # arm64 = Apple Silicon, x86_64 = Intel
brew --prefix                 # /opt/homebrew или /usr/local
scutil --get LocalHostName    # ожидается iMac-Mikhail
fdesetup status               # результат сообщить владельцу, см. ниже
```

Дальше в тексте адрес `iMac-Mikhail.local` и путь `/opt/homebrew`. Если
`LocalHostName` или префикс Homebrew другие, подставить фактические **везде**:
в сборке, plist, Caddyfile и проверках.

**FileVault.** Если `fdesetup status` показывает `FileVault is On`, после любой
перезагрузки (в том числе ночного обновления macOS) диск остаётся зашифрованным
до входа пользователя, и ни один сервис не поднимется. Не отключать FileVault
самостоятельно: сообщить владельцу, решение за ним. Варианты: выключить FileVault
или договориться, что после перезагрузки кто-то входит в систему на iMac.

Сон и питание:

```bash
sudo pmset -a sleep 0
sudo pmset -a disksleep 0
sudo pmset -a womp 1
sudo pmset -a autorestart 1
pmset -g | grep -E 'sleep|womp|autorestart'
```

Закрепить `192.168.1.80` за iMac резервированием DHCP на роутере.

## 1.3. Установка и сборка

```bash
brew install node@20 caddy
echo 'export PATH="'"$(brew --prefix)"'/opt/node@20/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
node --version                # ожидается v20.x

sudo mkdir -p /opt/robot-buhgalter
sudo chown mikhail:staff /opt/robot-buhgalter
git clone https://github.com/mleontev111-max/robot-buhgalter.git /opt/robot-buhgalter
cd /opt/robot-buhgalter
git checkout claude/github-connection-q4t7zr
npm ci
npm test
VITE_SYNC_SERVER_URL=https://iMac-Mikhail.local/sync npm run build
```

`chown` делать только на `/opt/robot-buhgalter`, не на весь `/opt`: на Apple
Silicon там лежит Homebrew.

`VITE_SYNC_SERVER_URL` вшивается в бандл при сборке. Это адрес, по которому сервер
доступен **из браузера Mac mini**, поэтому `localhost` здесь не годится.

## 1.4. Сервер синхронизации (launchd)

Файл `/Library/LaunchDaemons/ru.robot-buhgalter.sync.plist`. Сервис работает от
пользователя `mikhail`, не от root:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>ru.robot-buhgalter.sync</string>
  <key>UserName</key><string>mikhail</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/opt/node@20/bin/node</string>
    <string>/opt/robot-buhgalter/server/index.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>/opt/robot-buhgalter</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>8787</string>
    <key>ALLOWED_ORIGINS</key><string>https://iMac-Mikhail.local</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/opt/robot-buhgalter/logs/sync.log</string>
  <key>StandardErrorPath</key><string>/opt/robot-buhgalter/logs/sync.err</string>
</dict>
</plist>
```

На Intel путь к Node: `/usr/local/opt/node@20/bin/node`.

```bash
mkdir -p /opt/robot-buhgalter/logs
sudo chown root:wheel /Library/LaunchDaemons/ru.robot-buhgalter.sync.plist
sudo chmod 644 /Library/LaunchDaemons/ru.robot-buhgalter.sync.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/ru.robot-buhgalter.sync.plist
curl -sS http://127.0.0.1:8787/api/health
```

Ожидается `{"ok":true,"service":"robot-buhgalter-sync"}`.

`ALLOWED_ORIGINS` должен совпадать с адресом страницы символ в символ: схема, хост,
порт, без слэша в конце. Переменную `HOST` не задавать.

## 1.5. Caddy (HTTPS)

HTTPS обязателен по двум причинам. Шифрование ключей в браузере (WebCrypto)
работает только по HTTPS. А страница по HTTPS не может обращаться к серверу по
HTTP: браузер заблокирует это как mixed content.

Файл `$(brew --prefix)/etc/Caddyfile`:

```caddy
iMac-Mikhail.local {
    tls internal
    encode gzip

    handle_path /sync/* {
        reverse_proxy 127.0.0.1:8787
    }

    handle {
        root * /opt/robot-buhgalter/dist
        try_files {path} /index.html
        file_server
    }
}
```

```bash
caddy validate --config "$(brew --prefix)/etc/Caddyfile"
sudo brew services start caddy      # от root, чтобы занять порт 443
sudo brew services list
```

## 1.6. Сертификат на Mac mini

На iMac:

```bash
sudo find /var/root/Library/Application\ Support/Caddy -name root.crt
```

Скопировать файл на Mac mini и добавить в доверенные:

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain ~/Downloads/root.crt
```

Перезапустить браузер на Mac mini.

## 1.7. Обновление

```bash
cd /opt/robot-buhgalter
git pull
npm ci
npm test
VITE_SYNC_SERVER_URL=https://iMac-Mikhail.local/sync npm run build
sudo launchctl kickstart -k system/ru.robot-buhgalter.sync
```

## 1.8. Безопасность iMac

- В интернет не публиковать. Проброс портов на роутере не настраивать. Доступ
  только из домашней сети или через VPN: у сервера синхронизации и у приложения
  нет авторизации.
- Порт `8787` наружу не открывать, сервер слушает только `127.0.0.1`.
- API-ключи маркетплейсов только read-only. На iMac они не попадают никуда: ни в
  plist, ни в `.env`, ни в логи. Владелец вводит их в браузере.

## 1.9. Приёмка этапа 1 (всё проверять с Mac mini)

1. `https://iMac-Mikhail.local` открывается, сертификат доверенный, в консоли
   браузера нет ошибок.
2. `https://iMac-Mikhail.local/sync/api/health` отдаёт
   `{"ok":true,"service":"robot-buhgalter-sync"}`.
3. На странице «Подключения» сервер синхронизации в состоянии «доступен».
4. В консоли нет ошибок CORS и предупреждений mixed content.
5. Проверка одного реального read-only ключа («Проверить») проходит.
6. Синхронизация за `01.01.2026 – 30.09.2026` по одному кабинету возвращает
   непустой список операций.
7. Шифрование ключей паролем включается без ошибок.
8. `nc -vz 192.168.1.80 8787` с Mac mini завершается отказом.
9. После перезагрузки iMac приложение и `/sync/api/health` снова доступны.
   Если FileVault включён, указать, понадобился ли вход в систему.
10. `pmset -g` показывает `sleep 0` и `autorestart 1`.
11. Обновление по п. 1.7 выполнено хотя бы один раз и прошло без ошибок.

Отчёт: адрес, значение `VITE_SYNC_SERVER_URL`, результат `fdesetup status`,
результат по каждому из 11 пунктов. **После отчёта дождаться подтверждения
владельца, только потом переходить к этапу 2.**

---

# Этап 2. Удаление робота с Hetzner

Сервер `ai-vpn` **общий**. На нём работают другие проекты (в том числе project2)
и VPN. База робота лежит в контейнере `project2-postgres`, который принадлежит
project2. Удаляется только то, что относится к роботу. Сервер, контейнер
`project2-postgres`, сеть `apps-net`, чужие сайты в Caddy не трогать.

Доступ: `ssh mihail@ai-vpn` (пользователь с `sudo`), ключ по согласованию с
владельцем.

Нельзя: выводить в терминал, лог или чат содержимое `.env` целиком, пароли и
`DATABASE_URL`; класть копии в Git, почту или мессенджеры.

## 2.1. Опись (ничего не менять)

```bash
cd /opt/apps/robot-buhgalter && ls -la
docker compose ps
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -i robot
docker images | grep -i robot
sudo ss -ltnp | grep 8788
sudo crontab -l; crontab -l; ls /etc/cron.d
sudo ufw status numbered
```

Найти, где работает Caddy (на хосте или в контейнере) и какие блоки ссылаются на
робота:

```bash
systemctl status caddy --no-pager 2>/dev/null | head -5
docker ps --format '{{.Names}}' | grep -i caddy
sudo grep -rn -i -E 'robot|8788' /etc/caddy 2>/dev/null
```

Найти базу и роли робота **по факту**, не по догадке:

```bash
docker exec -it project2-postgres psql -U postgres -c '\l'
docker exec -it project2-postgres psql -U postgres -c '\du'
```

Если суперпользователь называется не `postgres`, взять имя из конфигурации
project2, не меняя её.

Прислать владельцу опись: имя базы робота, роли робота, какие блоки Caddy, cron и
UFW относятся к роботу. **Без подтверждения владельца дальше не идти.**

## 2.2. Резервная копия

Удаляемое может понадобиться, если окажется, что что-то было завязано на робота.

```bash
TS=$(date +%Y%m%d-%H%M)
mkdir -p ~/robot-archive-$TS
docker exec project2-postgres pg_dump -U postgres -Fc <БАЗА_РОБОТА> > ~/robot-archive-$TS/db.dump
sudo tar czf ~/robot-archive-$TS/app-dir.tgz -C /opt/apps robot-buhgalter
docker image save robot-buhgalter-api -o ~/robot-archive-$TS/image.tar   # если образ есть
ls -lh ~/robot-archive-$TS
```

Архив содержит `.env` с секретами. Скачать его владельцу по `scp` в зашифрованное
место (например, зашифрованный образ диска на Mac), затем удалить с сервера.
Срок хранения: 3 месяца, дальше владелец удаляет.

## 2.3. Остановка и удаление

```bash
cd /opt/apps/robot-buhgalter
docker compose down
docker image rm <образы робота из описи>
```

База и роли робота (имена из описи, подтверждённые владельцем):

```bash
docker exec -it project2-postgres psql -U postgres -c 'DROP DATABASE <БАЗА_РОБОТА>;'
docker exec -it project2-postgres psql -U postgres -c 'DROP ROLE <РОЛЬ_1>;'
# повторить для каждой роли робота
```

Если `DROP ROLE` отвечает, что роль владеет объектами в другой базе, остановиться
и сообщить владельцу: значит, роль используется где-то ещё.

Caddy: удалить блок(и) робота, затем

```bash
sudo caddy validate --config /etc/caddy/Caddyfile   # путь по факту из описи
sudo systemctl reload caddy                          # или reload в контейнере
```

Удалить cron-задачи и правила UFW робота, если они нашлись в описи. Затем:

```bash
sudo rm -rf /opt/apps/robot-buhgalter
```

## 2.4. Приёмка этапа 2

1. `docker ps -a | grep -i robot` пусто.
2. `sudo ss -ltnp | grep 8788` пусто.
3. `\l` и `\du` в `project2-postgres` не показывают базу и роли робота.
4. project2 работает так же, как до начала работ (проверить его основной адрес).
5. Остальные сайты на Caddy отвечают; `caddy validate` без ошибок.
6. `/opt/apps/robot-buhgalter` отсутствует.
7. Архив передан владельцу и удалён с сервера.

Отчёт: что удалено (контейнеры, образы, база, роли, блоки Caddy, cron, UFW) и
результат по 7 пунктам.

---

# Этап 3. Выключение kolyman.ru и порядок в репозитории (владелец / Claude)

Выполняется после приёмки этапа 2.

1. GitHub → репозиторий → Settings → Pages: снять публикацию.
2. Удалить из репозитория `CNAME` и `.github/workflows/deploy-pages.yml`, чтобы
   сайт не опубликовался снова при следующем слиянии в `main`.
3. У регистратора домена удалить записи `kolyman.ru`, указывающие на GitHub Pages.
   Сам домен остаётся за владельцем.
4. Закрыть PR #3 без слияния. Ветку `recovery/production-backend-2026-08-27`
   не удалять: это архив кода бэкенда.
5. Обновить `README.md`, `AGENTS.md`, `PROJECT_STATUS.md`, `PROJECT_STATE.json`,
   `ACTIVE_WORK.json` и сделать checkpoint: приложение работает на iMac,
   Hetzner больше не используется, PR #3 в архиве.

---

## Риск, который остаётся после переезда

Данные хранятся в браузере Mac mini, а не на iMac. Если Mac mini сломается или
данные сайта будут очищены, всё пропадёт. Единственная защита: регулярный экспорт
(«Настройки» → «Скачать безопасную копию») раз в неделю в папку, которая попадает
в Time Machine или iCloud Drive.
