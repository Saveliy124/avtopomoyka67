# CarWash Management System

Система управления автомойкой: онлайн-запись клиентов, расписание боксов, касса, отчётность, журнал аудита.

---

## Стек технологий

| Слой | Технология |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query |
| Backend | Node.js, Express, ESM-модули |
| База данных | PostgreSQL 16 |
| Инфраструктура | Docker, Docker Compose |

---

## Структура проекта

```
WEBCARS/
├── docker-compose.yml          # Оркестрация: db + backend + frontend
├── Dockerfile.dev              # Docker-образ фронтенда (dev-режим)
├── .env.example                # Шаблон переменных окружения
├── .gitignore
├── index.html
├── src/                        # Исходный код фронтенда
│   ├── api/                    # HTTP-клиенты (axios)
│   ├── components/             # React-компоненты
│   │   ├── admin/              # Панели администратора
│   │   ├── shared/             # Общие компоненты
│   │   └── ui/                 # Базовые UI-элементы
│   ├── pages/                  # Страницы приложения
│   ├── store/                  # Zustand-хранилища
│   ├── types/                  # TypeScript-типы
│   └── utils/                  # Вспомогательные функции
└── server/
    ├── Dockerfile              # Docker-образ бэкенда
    ├── .env.example            # Шаблон переменных для локального запуска
    ├── package.json
    ├── scripts/
    │   ├── seed.js             # Загрузка тестовых данных
    │   ├── initDb.js           # Инициализация схемы БД
    │   └── reset-db.js         # Сброс базы данных
    └── src/
        ├── server.js           # Точка входа
        ├── controllers/        # Обработчики маршрутов
        ├── routes/             # Маршруты Express
        ├── services/           # Бизнес-логика (аудит, no_show job и др.)
        ├── middleware/         # Auth, errorHandler, notFound
        ├── db/                 # Подключение к PostgreSQL
        ├── utils/              # JWT, permissions, errors
        └── sql/
            └── schema.sql      # Схема БД (применяется автоматически в Docker)
```

---

## Роли и права доступа

| Роль | Доступ |
|---|---|
| `client` | Личный кабинет, запись на мойку |
| `employee` | Расписание, записи мойки, касса (по разрешениям) |
| `admin` | Полный доступ ко всем разделам |

Разрешения сотрудника (`employee_permissions`): `can_manage_bookings`, `can_manage_cash`, `can_view_reports`, `can_manage_employees`, `can_manage_services`, `can_view_ai_audit`.

---

## Запуск через Docker

Рекомендуемый способ. Не требует ручной установки PostgreSQL.

### Требования

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — должен быть запущен перед выполнением команд.

### 1. Создать файл окружения

```bash
copy .env.example .env
```

Значения по умолчанию готовы к работе. При необходимости отредактируйте `.env`.

### 2. Запустить все сервисы

```bash
docker compose up -d
```

При первом запуске Docker загрузит образы (~80 МБ). Время запуска: 1-3 минуты.

После старта:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000/api
- Health check: http://localhost:4000/api/health

### 3. Загрузить тестовые данные (опционально)

```bash
docker compose exec backend npm run db:seed
```

Создаёт тестовых пользователей:

| Роль | Email | Пароль |
|---|---|---|
| Администратор | `admin@carwash.local` | `admin123` |
| Сотрудник | `employee@carwash.local` | `employee123` |
| Клиент | `client@carwash.local` | `client123` |

---

## Управление контейнерами

```bash
# Статус контейнеров
docker compose ps

# Логи всех сервисов
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend

# Остановить (данные сохраняются)
docker compose stop

# Остановить и удалить контейнеры (данные в volume сохраняются)
docker compose down

# Полный сброс включая данные БД
docker compose down -v
```

---

## Запуск без Docker

Требует локально установленных Node.js v18+ и PostgreSQL.

### Бэкенд

```bash
cd server
copy .env.example .env
# Отредактировать server/.env: указать параметры своей БД
npm install
npm run db:init
npm run db:seed
npm run dev
# Бэкенд: http://localhost:4000
```

### Фронтенд

```bash
# В корне проекта, в отдельном терминале
npm install
npm run dev
# Фронтенд: http://localhost:5173
```

---

## API — основные маршруты

| Метод | Маршрут | Описание |
|---|---|---|
| POST | `/api/auth/login` | Авторизация |
| POST | `/api/auth/register` | Регистрация |
| GET | `/api/bookings` | Список записей (своих или всех) |
| POST | `/api/bookings` | Создать запись |
| PATCH | `/api/bookings/:id/status` | Изменить статус записи |
| GET | `/api/slots` | Расписание |
| POST | `/api/slots/generate-day` | Сгенерировать расписание на день |
| PATCH | `/api/slots/bulk-status` | Массовое изменение статуса слотов |
| GET | `/api/services` | Список услуг |
| GET | `/api/boxes` | Список боксов |
| GET | `/api/cash` | Кассовые операции |
| GET | `/api/reports/summary` | Сводный отчёт |
| GET | `/api/audit` | Журнал действий |
| GET | `/api/users` | Список пользователей (admin) |

---

## Фоновые задачи

- **Закрытие прошедших слотов** — cron каждую минуту: слоты с истёкшим временем автоматически помечаются `is_available = FALSE`.
- **Статус "не явился"** — запускается при старте сервера и каждые 60 минут: записи со статусом `confirmed` или `in_progress`, дата которых меньше текущей, переводятся в `no_show`.

---

## Переменные окружения

Корневой `.env` (для Docker Compose):

```env
POSTGRES_DB=carwash_db
POSTGRES_USER=carwash_user
POSTGRES_PASSWORD=carwash_pass
POSTGRES_PORT=5432

BACKEND_PORT=4000
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d

FRONTEND_PORT=5173
```

`server/.env` (для локального запуска без Docker):

```env
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=carwash_db
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=7d
```

---

## Устранение неполадок

**Ошибка `port is already allocated`**
Порт занят другим процессом. Измените в `.env`: `BACKEND_PORT=4001` или `FRONTEND_PORT=5174`.

**Контейнер `carwash_db` не переходит в статус `healthy`**
Выполните `docker compose logs db`. Обычно причина — некорректный volume от предыдущего запуска. Сброс: `docker compose down -v && docker compose up -d`.

**Фронтенд не отвечает после запуска**
Vite при первом запуске может стартовать до 60 секунд. Проверьте: `docker compose logs frontend`.

**Нужна чистая база данных**
```bash
docker compose down -v
docker compose up -d
```
