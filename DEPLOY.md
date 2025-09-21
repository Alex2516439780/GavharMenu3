# Деплой и эксплуатация

## Подготовка

1. Установить Node LTS и npm.
2. Скопировать `.env.example` в `.env` и заполнить значения.
3. `npm ci`

## Сборка и запуск

```bash
npm run build
npm run images:generate
npm run update-version
npm start
```

Рекомендуется запускать через PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Обновление версии

```bash
git pull
npm ci
npm run build
npm run images:generate
npm run update-version
pm2 restart gavhar
```

## Бэкапы

- Ежедневно создаются локальные бэкапы SQLite в папке `backups/` (хранится 14 копий).
- Рекомендуется выгружать во внешнее хранилище (см. rclone в README).

## Сервис‑воркер

- Статика и API кэшируются; офлайн‑страница `offline.html` и запасная картинка работают автоматически.
- При проблемах кэша: обновить страницу с Ctrl+F5.

## Логи и мониторинг

- Медленные запросы (>300мс) помечаются как `[slow]` в логах.
- В продакшене скрыты лишние `console.log` (включить можно параметром `?debug`).
