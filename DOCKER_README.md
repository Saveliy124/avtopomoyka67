# Docker-инструкция

## Что добавлено
- `docker-compose.yml` — поднимает PostgreSQL, backend и frontend
- `Dockerfile.front` — сборка Vite-приложения и раздача через Nginx
- `nginx.conf` — конфиг для SPA
- `server/Dockerfile` — контейнер для backend
- `.dockerignore` и `server/.dockerignore`

## Как запустить
1. Установить Docker и Docker Compose.
2. Открыть терминал в корне проекта.
3. Выполнить:

```bash
docker compose up -d --build
```

## Что поднимется
- Frontend: `http://localhost`
- Backend: `http://localhost:4000`
- PostgreSQL: `localhost:5433`

## Полезные команды
### Посмотреть логи
```bash
docker compose logs -f
```

### Логи только backend
```bash
docker compose logs -f backend
```

### Остановить контейнеры
```bash
docker compose down
```

### Остановить и удалить volume с БД
```bash
docker compose down -v
```

## Важные замечания
- В Docker backend подключается к БД по хосту `db`, а не `localhost`.
- Для frontend API URL передаётся при сборке: `http://localhost:4000/api`.
- Если на сервере нужен домен/HTTPS, лучше вынести Nginx наружу или добавить reverse proxy.
