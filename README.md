# Wespro POS System v1.1

Профессиональная система управления точкой продажи (POS) с полнофункциональным бэкенд-API и современным веб-интерфейсом для управления заказами, инвентарем, платежами и отчетностью.

## 🎯 Основные возможности

- **Управление заказами** - Создание, редактирование и отслеживание заказов в реальном времени
- **Управление инвентарем** - Контроль запасов товаров, поступления и расходы
- **Система платежей** - Поддержка различных методов оплаты и интеграция с платежными системами
- **Управление ассортиментом** - Категоризация товаров и управление техническими карточками
- **Смены кассира** - Открытие/закрытие смен с контролем наличности
- **Аудит и отчетность** - Подробные логи операций и аналитические отчеты
- **Уведомления** - Система оповещений об событиях
- **Аутентификация** - Безопасная авторизация с JWT

## 🏗️ Архитектура проекта

```
wespro/
├── backend/                           # NestJS API сервер
│   ├── src/
│   │   ├── modules/                  # Основные модули приложения
│   │   │   ├── auth/                 # Аутентификация и авторизация
│   │   │   ├── users/                # Управление пользователями
│   │   │   ├── orders/               # Управление заказами
│   │   │   ├── products/             # Каталог товаров
│   │   │   ├── tables/               # Управление столами
│   │   │   ├── categories/           # Категории товаров
│   │   │   ├── inventory/            # Инвентарь
│   │   │   ├── stock-receipts/       # Поступления товара
│   │   │   ├── receipts/             # Квитанции
│   │   │   ├── payments/             # Платежи
│   │   │   ├── cash-shifts/          # Управление сменами
│   │   │   ├── notifications/        # Уведомления
│   │   │   ├── reports/              # Отчеты
│   │   │   ├── audit/                # Аудит и логирование
│   │   │   ├── settings/             # Настройки системы
│   │   │   └── tech-cards/           # Технические карточки
│   │   ├── api/                      # API маршруты
│   │   ├── config/                   # Конфигурация (БД, etc)
│   │   ├── middleware/               # Express middleware
│   │   ├── utils/                    # Утилиты и вспомогательные функции
│   │   └── index.ts                  # Точка входа приложения
│   ├── scripts/                      # Утилиты для разработки
│   ├── tests/                        # Тесты
│   ├── prisma/                       # Prisma схема БД
│   ├── Dockerfile                    # Docker конфигурация
│   ├── package.json
│   └── README.md
│
├── pos-terminal/                      # React фронтенд приложение
│   ├── src/
│   │   ├── components/               # React компоненты
│   │   ├── screens/                  # Экраны приложения
│   │   │   ├── LoginScreen           # Авторизация
│   │   │   ├── MenuScreen            # Меню
│   │   │   ├── OpenShiftScreen       # Открытие смены
│   │   │   └── StockReceiptScreen    # Поступление товара
│   │   ├── services/                 # API клиент и WebSocket
│   │   ├── store/                    # State management (Zustand)
│   │   ├── types/                    # TypeScript типы
│   │   └── App.tsx                   # Главный компонент
│   └── package.json
│
└── README.md                          # Этот файл
```

## 🚀 Быстрый старт

### Требования

- **Node.js** >= 18.x
- **npm** >= 9.x или **yarn**
- **PostgreSQL** >= 12.x (или другая совместимая БД)
- **Docker** (опционально)

### Установка и запуск

#### 1. Клонирование репозитория

```bash
git clone https://github.com/deepunites/Pos-.git
cd Pos-
```

#### 2. Распаковка архива (если требуется)

```bash
unzip "wespro 1.1.zip"
cd wespro
```

#### 3. Установка зависимостей бэкенда

```bash
cd backend
npm install
```

#### 4. Конфигурация окружения

Создайте файл `.env` в папке `backend`:

```env
# Базы данных
DATABASE_URL="postgresql://user:password@localhost:5432/wespro_db"

# JWT
JWT_SECRET="your-secret-key-change-this"
JWT_EXPIRATION="24h"

# API
API_PORT=3001
API_HOST="0.0.0.0"

# Логирование
LOG_LEVEL="debug"

# CORS
CORS_ORIGIN="http://localhost:3000"
```

#### 5. Настройка базы данных

```bash
# Запуск миграций
npx prisma migrate dev

# (Опционально) Заполнение тестовыми данными
npm run seed
```

#### 6. Запуск бэкенда

```bash
# Разработка (с горячей перезагрузкой)
npm run dev

# Продакшен
npm run build
npm run start
```

Бэкенд будет доступен на `http://localhost:3001`

#### 7. Установка зависимостей фронтенда

```bash
cd ../pos-terminal
npm install
```

#### 8. Конфигурация фронтенда

Создайте файл `.env.local` в папке `pos-terminal`:

```env
VITE_API_URL="http://localhost:3001/api"
VITE_WS_URL="ws://localhost:3001"
```

#### 9. Запуск фронтенда

```bash
# Разработка
npm run dev

# Продакшен
npm run build
npm run preview
```

Приложение будет доступно на `http://localhost:5173`

## 📦 Установка с Docker

```bash
# Сборка и запуск
docker-compose up --build

# Фоновый режим
docker-compose up -d

# Остановка
docker-compose down
```

## 🔧 Доступные команды

### Backend

```bash
cd backend

# Разработка
npm run dev              # Запуск с горячей перезагрузкой
npm run build            # Сборка проекта
npm run start            # Запуск собранного кода

# Базы данных
npm run prisma:migrate  # Запуск миграций
npm run prisma:studio   # Открытие Prisma Studio
npm run seed            # Заполнение БД тестовыми данными

# Тестирование
npm run test            # Запуск тестов
npm run test:watch      # Тесты в режиме наблюдения

# Скрипты
npm run check-data      # Проверка целостности данных
npm run ensure-users    # Создание обязательных пользователей
npm run seed-notif      # Инициализация уведомлений
```

### Frontend

```bash
cd pos-terminal

# Разработка
npm run dev             # Запуск dev сервера
npm run build           # Сборка для продакшена
npm run preview         # Превью собранного приложения
npm run type-check      # Проверка типов TypeScript
```

## 🌐 API Документация

### Основные эндпоинты

#### Аутентификация
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/refresh` - Обновление токена
- `POST /api/auth/logout` - Выход

#### Заказы
- `GET /api/orders` - Список заказов
- `POST /api/orders` - Создание заказа
- `GET /api/orders/:id` - Получение заказа
- `PATCH /api/orders/:id` - Обновление заказа
- `DELETE /api/orders/:id` - Удаление заказа

#### Товары
- `GET /api/products` - Список товаров
- `POST /api/products` - Создание товара
- `GET /api/products/:id` - Получение товара
- `PATCH /api/products/:id` - Обновление товара
- `DELETE /api/products/:id` - Удаление товара

#### Платежи
- `GET /api/payments` - История платежей
- `POST /api/payments` - Создание платежа
- `GET /api/payments/:id` - Информация о платеже

#### Отчеты
- `GET /api/reports/sales` - Отчет о продажах
- `GET /api/reports/inventory` - Отчет об инвентаре
- `GET /api/reports/daily` - Дневной отчет

#### Управление смен
- `POST /api/cash-shifts/open` - Открытие смены
- `POST /api/cash-shifts/close` - Закрытие смены
- `GET /api/cash-shifts/current` - Текущая смена

Полная документация доступна через Swagger на `/api/docs` (если включено)

## 🗄️ Структура базы данных

Проект использует **Prisma ORM** с миграциями. Основные таблицы:

- **users** - Пользователи и сотрудники
- **orders** - Заказы
- **order_items** - Товары в заказах
- **products** - Каталог товаров
- **categories** - Категории товаров
- **inventory** - Текущий инвентарь
- **stock_receipts** - Поступления товаров
- **payments** - Информация о платежах
- **cash_shifts** - Смены кассиров
- **audit_logs** - Логи аудита
- **notifications** - Уведомления

Просмотр и редактирование схемы:
```bash
cd backend
npx prisma studio
```

## 🧪 Тестирование

```bash
cd backend

# Все тесты
npm run test

# С покрытием
npm run test:cov

# В режиме наблюдения
npm run test:watch
```

Конфигурация: `vitest.config.ts`

## 📋 Модули и их функциональность

### Auth Module
Управление аутентификацией пользователей, JWT токенами и сессиями.

### Users Module
CRUD операции для пользователей, управление ролями и правами доступа.

### Orders Module
Полный жизненный цикл заказов: создание, редактирование, отслеживание статуса. Поддержка WebSocket для real-time обновлений.

### Products Module
Управление каталогом товаров, ценами, описаниями и изображениями.

### Tables Module
Управление столами в ресторане (если применимо), их доступностью и назначением заказов.

### Inventory Module
Отслеживание уровня запасов, настройки минимальных уровней, алерты.

### Stock Receipts Module
Регистрация поступлений товаров, обновление инвентаря, документооборот.

### Payments Module
Обработка различных методов платежей, интеграция с платежными системами.

### Cash Shifts Module
Управление кассовыми смен: открытие/закрытие, контроль наличности, отчетность.

### Reports Module
Генерация аналитических отчетов: по продажам, инвентарю, финансов.

### Audit Module
Логирование всех действий пользователей для контроля и аудита.

### Notifications Module
Система push-уведомлений и оповещений о событиях.

### Categories Module
Организация товаров по категориям для удобства поиска и управления.

### Tech Cards Module
Управление техническими описаниями, рецептами или спецификациями товаров.

## 🔐 Безопасность

- **JWT Authentication** - Токен-базированная аутентификация
- **Rate Limiting** - Ограничение частоты запросов (middleware/rateLimiter)
- **CORS** - Кросс-доменная защита
- **Input Validation** - Валидация всех входящих данных через Zod/Joi схемы
- **SQL Injection Prevention** - Использование Prisma ORM
- **Environment Variables** - Конфиденциальные данные в .env файлах

## 🌍 Переменные ок��ужения

### Backend (.env)

```env
# База данных
DATABASE_URL=postgresql://user:password@localhost:5432/wespro

# Аутентификация
JWT_SECRET=your-secret-key
JWT_EXPIRATION=24h

# API
API_PORT=3001
API_HOST=0.0.0.0

# Фронтенд
FRONTEND_URL=http://localhost:3000

# Логирование
LOG_LEVEL=debug

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

### Frontend (.env.local)

```env
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001
VITE_APP_NAME=Wespro POS
```

## 📱 Технологический стек

### Backend
- **[NestJS](https://nestjs.com/)** - Progressive Node.js framework
- **[Prisma](https://www.prisma.io/)** - ORM для работы с БД
- **[PostgreSQL](https://www.postgresql.org/)** - Реляционная база данных
- **[JWT](https://jwt.io/)** - Аутентификация
- **[Zod](https://zod.dev/)** - Валидация схем
- **[Vitest](https://vitest.dev/)** - Unit тестирование

### Frontend
- **[React](https://react.dev/)** - UI библиотека
- **[TypeScript](https://www.typescriptlang.org/)** - Типизация JavaScript
- **[Zustand](https://zustand-demo.vercel.app/)** - State management
- **[Socket.io](https://socket.io/)** - Real-time коммуникация
- **[Vite](https://vitejs.dev/)** - Build tool

## 🚢 Развертывание

### На сервер (Ubuntu/Linux)

```bash
# 1. Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Клонирование репозитория
git clone https://github.com/deepunites/Pos-.git
cd Pos-/wespro

# 3. Установка и конфигурация
cd backend
npm install
cp .env.example .env  # Отредактировать конфиг

# 4. Миграции БД
npx prisma migrate deploy

# 5. Сборка и запуск
npm run build
npm run start

# 6. Использование PM2 для управления
npm install -g pm2
pm2 start dist/main.js --name "wespro-api"
pm2 save
```

### На Heroku

```bash
# 1. Логин в Heroku
heroku login

# 2. Создание приложения
heroku create your-app-name

# 3. Установка переменных окружения
heroku config:set DATABASE_URL=your_database_url
heroku config:set JWT_SECRET=your_secret

# 4. Развертывание
git push heroku main
```

### На Railway, Render, или других сервисах

Указать build команду: `npm run build`
Указать start команду: `npm run start`

## 📊 Мониторинг и логирование

- **Logger** - Встроенное логирование в `src/utils/logger.ts`
- **Audit Logs** - Все действия записываются в БД
- **Request/Response Logging** - Логирование HTTP запросов

## 🤝 Вклад в проект

1. Создайте свою ветку (`git checkout -b feature/AmazingFeature`)
2. Сделайте коммиты (`git commit -m 'Add some AmazingFeature'`)
3. Отправьте на GitHub (`git push origin feature/AmazingFeature`)
4. Откройте Pull Request

## 📝 Лицензия

Этот проект принадлежит компании DeepUnites. Использование только с разрешения.

## 🆘 Решение проблем

### Проблема: "Cannot connect to database"
- Проверьте `DATABASE_URL` в `.env`
- Убедитесь, что PostgreSQL запущен
- Проверьте правильность учетных данных

### Проблема: "Port 3001 already in use"
- Измените `API_PORT` в `.env`
- Или остановите процесс использующий порт: `lsof -ti:3001 | xargs kill -9`

### Проблема: "CORS errors"
- Проверьте `CORS_ORIGIN` в `.env`
- Убедитесь, что URL фронтенда совпадает

### Проблема: "Module not found"
```bash
# Переустановка зависимостей
rm -rf node_modules package-lock.json
npm install
```

## 📞 Контакты и поддержка

- **GitHub Issues** - https://github.com/deepunites/Pos-/issues
- **Email** - support@deepunites.com

## 🗓️ История версий

### v1.1
- Улучшенная система управления заказами
- Новая система уведомлений
- Оптимизация производительности
- Расширенная аналитика

### v1.0
- Начальный релиз
- Базовая функциональность POS

---

**Последнее обновление:** Сентябрь 2026

Спасибо за использование Wespro POS System! 🎉
