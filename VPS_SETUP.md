# 🖥️ Полная инструкция по настройке VPS сервера

## 📋 Системные требования

- **ОС**: Ubuntu 20.04+ или Debian 11+
- **RAM**: Минимум 1GB (рекомендуется 2GB+)
- **CPU**: 1 ядро (рекомендуется 2+)
- **Диск**: Минимум 10GB свободного места
- **Сеть**: Статический IP адрес

## 🔧 Установка системных зависимостей

### 1. Обновление системы
```bash
# Обновление пакетов
sudo apt update && sudo apt upgrade -y

# Установка базовых утилит
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### 2. Установка Node.js 18 LTS
```bash
# Добавление репозитория NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Установка Node.js
sudo apt-get install -y nodejs

# Проверка версии
node --version  # должно быть v18.x.x
npm --version   # должно быть 9.x.x
```

### 3. Установка PM2 (Process Manager)
```bash
# Глобальная установка PM2
sudo npm install -g pm2

# Проверка установки
pm2 --version
```

### 4. Установка Nginx
```bash
# Установка Nginx
sudo apt install nginx -y

# Запуск и автозапуск
sudo systemctl start nginx
sudo systemctl enable nginx

# Проверка статуса
sudo systemctl status nginx
```

### 5. Установка дополнительных зависимостей
```bash
# Утилиты для работы с изображениями
sudo apt install -y imagemagick

# Утилиты для сжатия
sudo apt install -y gzip

# Утилиты для работы с файлами
sudo apt install -y unzip zip

# Утилиты для мониторинга
sudo apt install -y htop iotop
```

## 🗄️ Настройка базы данных

### SQLite (встроенная, дополнительная установка не требуется)
```bash
# Проверка наличия SQLite
sqlite3 --version
```

## 🔐 Настройка безопасности

### 1. Настройка файрвола
```bash
# Установка UFW
sudo apt install ufw -y

# Базовые правила
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Разрешение SSH
sudo ufw allow ssh

# Разрешение HTTP и HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Включение файрвола
sudo ufw enable

# Проверка статуса
sudo ufw status
```

### 2. Настройка SSH (рекомендуется)
```bash
# Создание нового пользователя (если нужно)
sudo adduser deploy
sudo usermod -aG sudo deploy

# Настройка SSH ключей
mkdir -p ~/.ssh
chmod 700 ~/.ssh
# Добавьте ваш публичный SSH ключ в ~/.ssh/authorized_keys
```

## 📁 Подготовка директорий

```bash
# Создание директории для приложения
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www

# Создание директории для логов
sudo mkdir -p /var/log/gavhar
sudo chown -R $USER:$USER /var/log/gavhar
```

## 🚀 Развертывание приложения

### 1. Клонирование репозитория
```bash
# Переход в директорию
cd /var/www

# Клонирование репозитория
git clone https://github.com/Alex2516439780/GavharMenu3.git
cd GavharMenu3

# Установка прав доступа
sudo chown -R $USER:$USER /var/www/GavharMenu3
```

### 2. Установка зависимостей проекта
```bash
# Установка зависимостей
npm install --production

# Проверка установки
npm list --depth=0
```

### 3. Инициализация базы данных
```bash
# Инициализация БД
npm run init-db

# Проверка создания БД
ls -la database.sqlite
```

### 4. Настройка переменных окружения
```bash
# Создание .env файла
cp env.example .env

# Редактирование .env
nano .env
```

**Содержимое .env файла:**
```env
# Server Configuration
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com

# Database
DB_PATH=./database.sqlite

# JWT Secret (ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-$(openssl rand -hex 32)

# Admin Credentials (ОБЯЗАТЕЛЬНО ИЗМЕНИТЕ!)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-$(openssl rand -hex 16)

# File Upload
MAX_FILE_SIZE=15728640
UPLOAD_PATH=./uploads

# Backup Settings
BACKUP_ENABLED=true
```

### 5. Настройка прав доступа
```bash
# Права на директории
chmod 755 uploads/
chmod 755 backups/
chmod 755 logs/

# Права на файлы
chmod 644 database.sqlite
chmod 644 .env
```

## 🚀 Запуск приложения

### 1. Запуск с PM2
```bash
# Запуск приложения
pm2 start ecosystem.config.js

# Сохранение конфигурации
pm2 save

# Настройка автозапуска
pm2 startup

# Проверка статуса
pm2 status
pm2 logs gavhar
```

### 2. Настройка Nginx
```bash
# Создание конфигурации сайта
sudo nano /etc/nginx/sites-available/gavhar
```

**Содержимое конфигурации:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    root /var/www/GavharMenu3/public;
    index index.html;

    # API проксирование
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймауты
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Статические файлы
    location ~* \.(css|js|jpg|jpeg|png|gif|webp|avif|woff2|ttf|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }

    # Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

### 3. Активация сайта
```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/gavhar /etc/nginx/sites-enabled/

# Удаление дефолтной конфигурации
sudo rm /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx
```

## 🔒 Настройка SSL сертификата

### 1. Установка Certbot
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y
```

### 2. Получение SSL сертификата
```bash
# Получение сертификата (замените your-domain.com на ваш домен)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Автоматическое обновление
sudo crontab -e
# Добавьте строку: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Мониторинг и обслуживание

### 1. Полезные команды PM2
```bash
pm2 status          # Статус процессов
pm2 logs gavhar     # Просмотр логов
pm2 restart gavhar  # Перезапуск
pm2 stop gavhar     # Остановка
pm2 monit           # Мониторинг в реальном времени
```

### 2. Просмотр логов
```bash
# Логи приложения
tail -f /var/log/gavhar/out.log
tail -f /var/log/gavhar/error.log

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Системные логи
sudo journalctl -u nginx -f
```

### 3. Обновление приложения
```bash
# Переход в директорию
cd /var/www/GavharMenu3

# Остановка приложения
pm2 stop gavhar

# Обновление кода
git pull origin main

# Установка новых зависимостей
npm install --production

# Запуск приложения
pm2 start gavhar
```

## 🔧 Устранение неполадок

### 1. Проверка портов
```bash
# Проверка занятых портов
sudo netstat -tlnp | grep :3000
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :443
```

### 2. Проверка процессов
```bash
# Процессы Node.js
ps aux | grep node

# Процессы Nginx
ps aux | grep nginx
```

### 3. Проверка прав доступа
```bash
# Права на файлы
ls -la /var/www/GavharMenu3/
ls -la /var/www/GavharMenu3/uploads/
ls -la /var/www/GavharMenu3/database.sqlite
```

## ✅ Финальная проверка

После выполнения всех шагов проверьте:

1. **Приложение запущено**: `pm2 status`
2. **Nginx работает**: `sudo systemctl status nginx`
3. **Сайт доступен**: Откройте ваш домен в браузере
4. **API работает**: `curl https://your-domain.com/api/health`
5. **Админ-панель**: `https://your-domain.com/admin.html`

## 🎯 Готово!

Ваш сервер настроен и готов к работе! Приложение будет автоматически запускаться при перезагрузке сервера.

**Удачного развертывания! 🚀**
