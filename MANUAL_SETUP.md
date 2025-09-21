# 🖥️ Пошаговая инструкция по настройке VPS сервера

## 📋 Что нужно установить на сервере

### 1. **Node.js 18 LTS** - для запуска приложения
### 2. **PM2** - для управления процессами
### 3. **Nginx** - веб-сервер
### 4. **Git** - для клонирования кода
### 5. **UFW** - файрвол для безопасности

---

## 🚀 Пошаговая установка

### **ШАГ 1: Подключение к серверу**
```bash
ssh root@your-server-ip
# или
ssh username@your-server-ip
```

### **ШАГ 2: Обновление системы**
```bash
apt update
apt upgrade -y
```

### **ШАГ 3: Установка Node.js 18**
```bash
# Добавляем репозиторий NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -

# Устанавливаем Node.js
apt-get install -y nodejs

# Проверяем установку
node --version
npm --version
```
**Ожидаемый результат:** Node.js v18.x.x, npm 9.x.x

### **ШАГ 4: Установка PM2**
```bash
npm install -g pm2

# Проверяем установку
pm2 --version
```

### **ШАГ 5: Установка Nginx**
```bash
apt install nginx -y

# Запускаем и включаем автозапуск
systemctl start nginx
systemctl enable nginx

# Проверяем статус
systemctl status nginx
```

### **ШАГ 6: Установка дополнительных утилит**
```bash
apt install -y git curl wget unzip
```

### **ШАГ 7: Настройка файрвола**
```bash
# Устанавливаем UFW
apt install ufw -y

# Настраиваем правила
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443

# Включаем файрвол
ufw enable

# Проверяем статус
ufw status
```

---

## 📁 Развертывание приложения

### **ШАГ 8: Создание директории**
```bash
mkdir -p /var/www
cd /var/www
```

### **ШАГ 9: Клонирование репозитория**
```bash
git clone https://github.com/Alex2516439780/GavharMenu3.git
cd GavharMenu3
```

### **ШАГ 10: Установка зависимостей проекта**
```bash
npm install --production
```

### **ШАГ 11: Инициализация базы данных**
```bash
npm run init-db
```

### **ШАГ 12: Настройка переменных окружения**
```bash
# Копируем пример конфигурации
cp env.example .env

# Редактируем конфигурацию
nano .env
```

**Настройте .env файл:**
```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
DB_PATH=./database.sqlite
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=15728640
BACKUP_ENABLED=true
```

### **ШАГ 13: Настройка прав доступа**
```bash
chmod 755 uploads/
chmod 755 backups/
chmod 755 logs/
chmod 644 database.sqlite
chmod 644 .env
```

---

## 🚀 Запуск приложения

### **ШАГ 14: Запуск с PM2**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
pm2 status
```

### **ШАГ 15: Настройка Nginx**
```bash
# Создаем конфигурацию сайта
nano /etc/nginx/sites-available/gavhar
```

**Вставьте в файл:**
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
    }

    # Статические файлы
    location ~* \.(css|js|jpg|jpeg|png|gif|webp|avif|woff2|ttf|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### **ШАГ 16: Активация сайта**
```bash
# Создаем символическую ссылку
ln -s /etc/nginx/sites-available/gavhar /etc/nginx/sites-enabled/

# Удаляем дефолтную конфигурацию
rm /etc/nginx/sites-enabled/default

# Проверяем конфигурацию
nginx -t

# Перезапускаем Nginx
systemctl restart nginx
```

---

## 🔒 Настройка SSL (опционально)

### **ШАГ 17: Установка SSL сертификата**
```bash
# Устанавливаем Certbot
apt install certbot python3-certbot-nginx -y

# Получаем SSL сертификат (замените your-domain.com)
certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## ✅ Проверка работы

### **ШАГ 18: Тестирование**
```bash
# Проверяем статус PM2
pm2 status

# Проверяем статус Nginx
systemctl status nginx

# Проверяем API
curl http://localhost:3000/api/health

# Проверяем сайт
curl http://your-domain.com
```

---

## 📊 Полезные команды

### **Управление приложением:**
```bash
pm2 status          # Статус процессов
pm2 logs gavhar     # Просмотр логов
pm2 restart gavhar  # Перезапуск
pm2 stop gavhar     # Остановка
pm2 monit           # Мониторинг
```

### **Управление Nginx:**
```bash
systemctl status nginx    # Статус
systemctl restart nginx   # Перезапуск
systemctl reload nginx    # Перезагрузка конфигурации
nginx -t                  # Проверка конфигурации
```

### **Просмотр логов:**
```bash
# Логи приложения
tail -f /var/log/gavhar/out.log
tail -f /var/log/gavhar/error.log

# Логи Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 🔧 Обновление приложения

```bash
cd /var/www/GavharMenu3
pm2 stop gavhar
git pull origin main
npm install --production
pm2 start gavhar
```

---

## 🎯 Готово!

После выполнения всех шагов ваше приложение будет доступно по адресу:
- **HTTP:** http://your-domain.com
- **API:** http://your-domain.com/api
- **Админка:** http://your-domain.com/admin.html

**Удачного развертывания! 🚀**
