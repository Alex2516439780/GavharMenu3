# 🍽️ GAVHAR Restaurant Menu System

Современная система меню ресторана с админ-панелью, построенная на Node.js, Express и SQLite.

## ✨ Особенности

- 🎨 **Современный UI/UX** - Адаптивный дизайн для всех устройств
- 🌐 **Многоязычность** - Поддержка русского, узбекского и английского языков
- 📱 **PWA** - Прогрессивное веб-приложение с офлайн-режимом
- 🔍 **Поиск** - Быстрый поиск по блюдам с FTS5
- 🛒 **Корзина** - Интерактивная корзина с расчетом стоимости
- 🔐 **Админ-панель** - Полнофункциональная панель управления
- 📊 **Аналитика** - Отслеживание медленных запросов
- 🗄️ **Автобэкапы** - Ежедневные резервные копии базы данных
- 🚀 **Оптимизация** - Сжатие изображений, кэширование, минификация

## 🛠️ Технологии

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **SQLite** - База данных
- **JWT** - Аутентификация
- **bcryptjs** - Хеширование паролей
- **Multer** - Загрузка файлов
- **Sharp** - Обработка изображений

### Frontend
- **Vanilla JavaScript** - Без фреймворков
- **CSS3** - Современные стили
- **Service Worker** - Офлайн-функциональность
- **WebP/AVIF** - Оптимизированные изображения

### DevOps
- **PM2** - Process manager
- **Nginx** - Reverse proxy
- **GitHub Actions** - CI/CD
- **Docker** - Контейнеризация (опционально)

## 🚀 Быстрый старт

### Локальная разработка

1. **Клонирование репозитория**
```bash
git clone https://github.com/yourusername/gavhar-restaurant.git
cd gavhar-restaurant
```

2. **Установка зависимостей**
```bash
npm install
```

3. **Инициализация базы данных**
```bash
npm run init-db
```

4. **Запуск сервера**
```bash
npm start
```

5. **Открытие в браузере**
- Фронтенд: http://localhost:3000
- Админ-панель: http://localhost:3000/admin.html
- API: http://localhost:3000/api

### Доступ к админ-панели
- **Логин**: admin
- **Пароль**: admin123

## 📁 Структура проекта

```
gavhar-restaurant/
├── 📁 public/                 # Фронтенд файлы
│   ├── index.html            # Главная страница
│   ├── admin.html            # Админ-панель
│   ├── styles.css            # Стили
│   ├── script.js             # JavaScript
│   ├── sw.js                 # Service Worker
│   └── 📁 ELEMENTS/          # Статические ресурсы
├── 📁 routes/                # API маршруты
│   ├── auth.js              # Аутентификация
│   ├── dishes.js            # Блюда
│   ├── categories.js        # Категории
│   ├── settings.js          # Настройки
│   └── upload.js            # Загрузка файлов
├── 📁 models/               # Модели данных
│   └── database.js          # База данных
├── 📁 middleware/           # Middleware
│   └── auth.js              # Аутентификация
├── 📁 scripts/              # Скрипты сборки
├── 📁 uploads/              # Загруженные файлы
├── 📁 backups/              # Резервные копии
├── server.js                # Главный сервер
├── config.js                # Конфигурация
└── package.json             # Зависимости
```

## 🔧 API Endpoints

### Публичные
- `GET /api/categories` - Получить категории
- `GET /api/dishes` - Получить блюда
- `GET /api/dishes/search` - Поиск блюд
- `GET /api/dishes/:id` - Получить блюдо по ID
- `GET /api/settings` - Получить настройки
- `GET /api/health` - Проверка здоровья

### Админские (требуют JWT)
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/logout` - Выход из системы
- `GET /api/auth/verify` - Проверка токена
- `PUT /api/auth/change-password` - Смена пароля
- `POST /api/dishes` - Создать блюдо
- `PUT /api/dishes/:id` - Обновить блюдо
- `DELETE /api/dishes/:id` - Удалить блюдо
- `PATCH /api/dishes/:id/toggle-status` - Переключить статус
- `POST /api/upload/single` - Загрузить изображение
- `POST /api/upload/multiple` - Загрузить несколько изображений

## 🚀 Развертывание на VPS

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка PM2
sudo npm install -g pm2

# Установка Nginx
sudo apt install nginx -y
```

### 2. Клонирование и настройка

```bash
# Клонирование репозитория
git clone https://github.com/yourusername/gavhar-restaurant.git
cd gavhar-restaurant

# Установка зависимостей
npm install --production

# Инициализация базы данных
npm run init-db

# Создание .env файла
cp .env.example .env
nano .env
```

### 3. Конфигурация .env

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
DB_PATH=./database.sqlite
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=15728640
FRONTEND_URL=https://your-domain.com
BACKUP_ENABLED=true
```

### 4. Запуск с PM2

```bash
# Запуск приложения
pm2 start ecosystem.config.js

# Сохранение конфигурации
pm2 save

# Настройка автозапуска
pm2 startup
```

### 5. Настройка Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/gavhar-restaurant/public;
    index index.html;

    # API проксирование
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Кэширование статики
    location ~* \.(css|js|jpg|jpeg|png|gif|webp|avif|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### 6. SSL сертификат

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение SSL сертификата
sudo certbot --nginx -d your-domain.com
```

## 🔄 Автоматическое развертывание

### GitHub Actions

Создайте файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.SSH_KEY }}
        script: |
          cd /path/to/gavhar-restaurant
          git pull origin main
          npm install --production
          pm2 restart gavhar
```

## 📊 Мониторинг

### PM2 команды
```bash
pm2 status          # Статус процессов
pm2 logs gavhar     # Просмотр логов
pm2 restart gavhar  # Перезапуск
pm2 stop gavhar     # Остановка
```

### Логи приложения
```bash
tail -f logs/out.log    # Основные логи
tail -f logs/error.log  # Ошибки
```

## 🛠️ Разработка

### Доступные скрипты

```bash
npm start              # Запуск сервера
npm run dev            # Запуск в режиме разработки
npm run init-db        # Инициализация БД
npm run build          # Сборка проекта
npm run images:generate # Генерация изображений
npm run update-version # Обновление версии
```

### Структура базы данных

- **categories** - Категории блюд
- **subcategories** - Подкатегории
- **dishes** - Блюда
- **settings** - Настройки системы
- **admin_users** - Пользователи админки

## 🔒 Безопасность

- JWT токены с истечением через 24 часа
- Хеширование паролей с bcrypt
- Rate limiting (600 запросов/15 минут)
- Helmet для заголовков безопасности
- Валидация всех входных данных
- CORS настройки

## 📈 Производительность

- Сжатие gzip/brotli
- Кэширование статики (1 год)
- Кэширование API (5 минут)
- Оптимизация изображений (WebP/AVIF)
- Ленивая загрузка
- Service Worker кэширование

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit изменения (`git commit -m 'Add some AmazingFeature'`)
4. Push в branch (`git push origin feature/AmazingFeature`)
5. Откройте Pull Request

## 📄 Лицензия

Этот проект лицензирован под MIT License - см. файл [LICENSE](LICENSE) для деталей.

## 📞 Поддержка

При возникновении проблем:
1. Проверьте [Issues](https://github.com/yourusername/gavhar-restaurant/issues)
2. Создайте новый Issue с описанием проблемы
3. Приложите логи и скриншоты

## 🎯 Roadmap

- [ ] Мобильное приложение
- [ ] Интеграция с платежными системами
- [ ] Система заказов
- [ ] Аналитика и отчеты
- [ ] Мультитенантность
- [ ] API для мобильных приложений

---

**Сделано с ❤️ для GAVHAR Restaurant**