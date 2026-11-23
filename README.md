# 3D Kamron — сайт магазина плитки

Крупноформатный керамогранит: реклама магазина, каталог, 3D-конструктор комнаты,
заказ с доставкой для клиентов из-за границы, админка с push-уведомлениями о заказах.

**На чём написано:** сайт — HTML, CSS, JavaScript (без фреймворков), 3D — three.js (WebGL);
сервер — **C# / ASP.NET Core (.NET 10)**, без сторонних пакетов. Программы для ноутбуков —
отдельный репозиторий `tile-design-app` (Flutter).

**Языки сайта:** русский и узбекский (латиница), кнопка **UZ / RU** в шапке.

## Структура: каждая часть сайта — в своей папке
```
public/
  index.html            каркас страницы; части подставляет shared/loader.js
  nav/                  навигация: шапка, меню «☰», подвал, переходы между страницами
  home/                 главная (реклама магазина)
  catalog/              каталог
  constructor/          3D-конструктор (план, 3D, расчёт, накладная, презентация на ТВ)
  new/                  новинки
  sizes/                размеры 60×120, 75×150, 80×135
  contacts/             контакты
  cart/                 корзина и оформление заказа
  admin/                админка (открывается только по своему адресу)
  shared/               общее: стили, карточки товаров, перевод, рисование плитки,
                        data/products.json (каталог-пример), data/shop.json (данные магазина)
server/                 сервер на .NET
```
В каждой папке — свои `*.html`, `*.js`, `*.css`.

## Запуск на своём компьютере
Нужен .NET SDK 10.
```bash
cd server
dotnet run -- set-password     # один раз: пароль админки
dotnet run                     # сайт: http://127.0.0.1:3000, админка: http://127.0.0.1:3000/admin
```

## Установка на сервер (Ubuntu 24.04) и домен
1. В панели регистратора домена — запись **A** на IP сервера.
2. На сервере:
   ```bash
   sudo apt update && sudo apt install -y dotnet-sdk-10.0 git caddy
   sudo git clone https://github.com/anonimnoname/tile-shop-site /opt/tile-shop
   cd /opt/tile-shop/server && sudo dotnet publish -c Release -o /opt/tile-shop/app
   cd /opt/tile-shop && sudo dotnet app/TileShop.Server.dll set-password
   ```
3. Служба — `/etc/systemd/system/tile-shop.service`:
   ```ini
   [Unit]
   Description=3D Kamron site
   After=network.target

   [Service]
   WorkingDirectory=/opt/tile-shop
   ExecStart=/usr/bin/dotnet /opt/tile-shop/app/TileShop.Server.dll
   Environment=PORT=3000
   # Секретный адрес админки: https://ваш-домен/kamron-panel
   Environment=ADMIN_PATH=kamron-panel
   # Необязательно: админка только с этих IP
   # Environment=ADMIN_IPS=1.2.3.4
   # Необязательно: заказы ещё и в Telegram
   # Environment=TG_BOT_TOKEN=123456:ABC...
   # Environment=TG_CHAT_ID=123456789
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo systemctl enable --now tile-shop
   ```
4. HTTPS — `/etc/caddy/Caddyfile`:
   ```
   ваш-домен.uz, www.ваш-домен.uz {
       encode gzip
       reverse_proxy 127.0.0.1:3000
   }
   ```
   `sudo systemctl reload caddy` — сертификат Caddy получит и продлит сам.
5. **Резервные копии:** `data/` (товары, заказы, настройки, пароль, ключи) и `public/uploads/` (фото):
   `tar czf /root/backup-$(date +%F).tgz -C /opt/tile-shop data public/uploads`.

Обновить: `cd /opt/tile-shop && sudo git pull && cd server && sudo dotnet publish -c Release -o /opt/tile-shop/app && sudo systemctl restart tile-shop`.

## Перед запуском обязательно
- Админка → **Настройки**: телефон магазина (сейчас там только `+998`), Telegram, адрес, реквизиты для оплаты,
  сколько лет работаете и сколько клиентов (на главной «20+ лет», «100 000+ клиентов»).
- **Товары**: в каталоге примеры — замените на настоящие и загрузите фото каждой плиты.

## Как зайти в админку
**Один раз на сервере:** пароль — `sudo dotnet app/TileShop.Server.dll set-password` (из `/opt/tile-shop`);
секретный адрес — `Environment=ADMIN_PATH=kamron-panel` в службе, затем `sudo systemctl restart tile-shop`.

**Каждый раз:**
1. Программа **«3D Kamron Заказы»** (удобнее всего): при первом запуске «⋮ → Адрес сайта» — впишите
   `https://ваш-домен.uz` и `kamron-panel`; затем пароль → «Войти». Вход запоминается на 30 дней.
   Или в браузере: `https://ваш-домен.uz/kamron-panel` (по `/admin` админки нет — так задумано).
2. Разделы: **Заказы**, **Товары**, **Магазин** (настройки).
3. Впервые: «Магазин» — телефон, Telegram, адрес, реквизиты, цифры на главной → «Сохранить».

6 неверных паролей подряд — пауза 15 минут. Забыли пароль — снова `set-password` на сервере.

## Заказы
- **Push-уведомления на ноутбук:** в админке «🔔 Включить уведомления» (Chrome/Edge, только по https).
  Удобнее всего — программа «3D Kamron Заказы» на ноутбуке для заказов (репозиторий `tile-design-app`).
- **Подтверждение без предоплаты:** кнопки «Подтвердить в WhatsApp / Telegram» открывают чат с готовым
  сообщением (состав, сумма, адрес, реквизиты для перевода). Реквизиты на сайте не видны.
- Статусы: Новый → Подтверждён → Оплачен → В доставке → Выполнен.

## Как считается
- **Пол** — по настоящей раскладке на плане; мелкие куски подрезки режутся из одной плитки; +3% на бой.
- **Стены** — по каждой стене (можно разную плитку, «как пол»), минус двери и проёмы, запас 10–15%.
- **Цены в заказе** сервер пересчитывает по своему каталогу.
