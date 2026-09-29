# Деплой Qwik на Railway со своим доменом

Проект — это **четыре независимых сервиса** в одном Railway-проекте, собираемых
из одного репозитория:

| Сервис     | Папка (Root Directory) | Что это                       | Публичный адрес           |
|------------|------------------------|-------------------------------|---------------------------|
| `backend`  | `backend`              | API + база (SQLite на volume) | не нужен                  |
| `admin`    | `frontend-admin`       | панель управления             | `admin.qwik.uz`           |
| `terminal` | `pos-terminal`         | POS-терминал (касса)          | `pos.qwik.uz`             |
| `landing`  | `landing`              | сайт-визитка                  | `qwik.uz` и `www.qwik.uz` |

Backend наружу не открывается: admin и terminal обращаются к нему через
приватную сеть Railway, со стороны браузера это запросы на свой же домен.

---

## 1. Репозиторий

Railway деплоит по коммиту в GitHub. Залей корень проекта в свой репозиторий:

```bash
cd /home/deep/projects/pos/qwik
git init
git add .
git commit -m "Qwik POS"
git branch -M main
git remote add origin https://github.com/<аккаунт>/<репозиторий>.git
git push -u origin main
```

`.gitignore` уже настроен: `node_modules`, `dist`, `.env` и локальные базы
(`dev.db`, `test.db`) в репозиторий не попадут.

---

## 2. Четыре сервиса из одного репозитория

В Railway: **New Project → Deploy from GitHub repo**, выбрать репозиторий.
Затем добавить ещё три сервиса из того же репозитория (`+ New → GitHub Repo`,
тот же репозиторий) и каждому в **Settings → Source → Root Directory** указать
свою папку из таблицы выше. Railway сам найдёт `Dockerfile` в каждой папке.

Переименуй сервисы в `backend`, `admin`, `terminal`, `landing` — именем
сервиса определяется его внутренний адрес.

---

## 3. Backend: volume и переменные

### Volume (обязательно, иначе база стирается при каждом деплое)

**Settings → Volumes → New Volume**, mount path:

```
/data
```

Именно `/data`: папка `/app/prisma` внутри образа занята схемой Prisma,
монтирование тома поверх неё стёрло бы её.

### Variables

```
PORT=3000
NODE_ENV=production
DATABASE_URL=file:/data/qwik.db
JWT_SECRET=<сгенерировать>
JWT_REFRESH_SECRET=<сгенерировать>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PENDING_ORDER_TTL_MINUTES=30
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
CORS_ORIGIN=https://admin.qwik.uz,https://pos.qwik.uz
LOG_LEVEL=info
```

Секреты сгенерируй сам, по одному на каждую переменную — **не бери значения
из локального `.env`**:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Схема базы применяется сама при старте контейнера (`prisma migrate deploy`).
Миграции лежат в `backend/prisma/migrations` — это обычные SQL-файлы, данные
они не стирают.

`PENDING_ORDER_TTL_MINUTES` — через сколько минут неоплаченный заказ
автоматически отменяется и возвращает зарезервированный остаток на склад.

---

## 4. Admin и Terminal: переменные

Обоим сервисам нужна одна переменная — внутренний адрес backend
(имя сервиса + порт):

```
BACKEND_URL=backend.railway.internal:3000
```

Проверить имя можно в сервисе `backend` → **Settings → Networking → Private
Networking**. Порт, на котором слушает контейнер, Railway подставляет сам —
в образах это учтено (`listen ${PORT}`).

---

## 5. Landing: переменные

```
ADMIN_URL=https://admin.qwik.uz
POS_URL=https://pos.qwik.uz
CONTACT_EMAIL=hello@qwik.uz
```

Ссылки подставляются в страницу при старте контейнера — пересобирать образ
при смене домена не нужно.

---

## 6. Свой домен

Для каждого публичного сервиса: **Settings → Networking → Custom Domain**.

| Сервис     | Домен                     |
|------------|---------------------------|
| `landing`  | `qwik.uz` и `www.qwik.uz` |
| `admin`    | `admin.qwik.uz`           |
| `terminal` | `pos.qwik.uz`             |

Railway покажет, какую DNS-запись добавить у регистратора:

- поддомены (`www`, `admin`, `pos`) — **CNAME** на выданный Railway адрес
  вида `xxxx.up.railway.app`. Это основной рабочий путь;
- корень `qwik.uz` без поддомена — CNAME на корень по стандарту DNS ставить
  нельзя. У регистраторов в зоне `.uz` обычно нет ALIAS/ANAME, поэтому два
  варианта:
  1. **Через Cloudflare** (бесплатно): переключить NS-серверы домена на
     Cloudflare и добавить там CNAME `qwik.uz → xxxx.up.railway.app` с
     включённым прокси — Cloudflare сам развернёт его в адрес (CNAME
     flattening). Тогда и корень, и `www` работают одинаково.
  2. **Редирект у регистратора**: оставить сайт на `www.qwik.uz`, а на корне
     включить web-forwarding (перенаправление) на `https://www.qwik.uz`.
     Такая услуга есть у большинства `.uz`-регистраторов.

### Записи, которые нужно добавить

| Тип   | Имя (host) | Значение                       |
|-------|------------|--------------------------------|
| CNAME | `www`      | адрес сервиса `landing` из Railway  |
| CNAME | `admin`    | адрес сервиса `admin` из Railway    |
| CNAME | `pos`      | адрес сервиса `terminal` из Railway |
| —     | `@` (корень) | Cloudflare CNAME flattening или редирект на `https://www.qwik.uz` |

Точные значения Railway показывает в карточке каждого Custom Domain — они
разные для каждого сервиса.

DNS расходится от нескольких минут до пары часов; TLS-сертификат Railway
выпустит сам, как только увидит запись. Статус — там же, в Custom Domain.

После появления доменов вернись в переменные и подставь реальные значения:
`CORS_ORIGIN` (backend), `ADMIN_URL` / `POS_URL` (landing).

---

## 7. Первый запуск

1. Открой `https://admin.qwik.uz` → **«Зарегистрироваться»**.
2. Заполни: название заведения, имя, email, пароль (от 8 символов) —
   создастся заведение и аккаунт администратора.
3. В **Настройках** выбери валюту и часовой пояс — от них зависят и цены,
   и отчёты «за сегодня».
4. Заведи категории и товары, поставь наценку категориям. Если наценка 0%,
   цена продажи задаётся вручную — так и задумано, иначе приход приравнял бы
   её к себестоимости.
5. В **Сотрудниках** добавь кассира (роль `cashier`, можно PIN) — он входит
   на `https://pos.qwik.uz`.

Demo-данные (`npm run db:seed`) на проде запускать **не нужно**: они создают
«Demo Restaurant» с общеизвестными паролями.

---

## 8. Проверка после деплоя

```bash
curl -I https://qwik.uz
curl -I https://admin.qwik.uz
curl -I https://pos.qwik.uz
```

Состояние склада и цен можно проверить прямо на проде:

```bash
railway run --service backend npm run check-inventory
```

Скрипт покажет товары с ценой ниже себестоимости, приходы без движений
склада и зависшие резервы.

---

## Частые проблемы

- **502 на admin/terminal** — неверный `BACKEND_URL` или backend ещё не
  поднялся. Проверь Private Networking и логи backend.
- **Домен не подтверждается** — DNS-запись ещё не разошлась либо у
  регистратора включён прокси, подменяющий CNAME. Проверь `dig CNAME admin.qwik.uz`.
- **«no such table» в логах backend** — volume не смонтирован в `/data`
  или `DATABASE_URL` указывает мимо тома.
- **CORS-ошибки в консоли** — в обычной работе их быть не должно (admin и
  terminal ходят к API через свой nginx). Если появились — добавь домен в
  `CORS_ORIGIN` backend.
- **База пропала после деплоя** — не был подключён volume. Подключи и
  разверни заново; данные из старого контейнера не восстановить.

---

## Обновление кода

```bash
git add . && git commit -m "..." && git push
```

Railway пересоберёт затронутые сервисы сам. Миграции применятся при старте
backend.
