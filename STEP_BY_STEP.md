# 🖥️ Пошаговая установка на VPS сервер

## 📋 Команды для выполнения по порядку

### **ШАГ 1: Подключение к серверу**
```bash
ssh root@your-server-ip
```

### **ШАГ 2: Обновление системы**
```bash
apt update
apt upgrade -y
```

### **ШАГ 3: Установка Node.js 18**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
node --version
npm --version
```

### **ШАГ 4: Установка PM2**
```bash
npm install -g pm2
pm2 --version
```

### **ШАГ 5: Установка Nginx**
```bash
apt install nginx -y
systemctl start nginx
systemctl enable nginx
systemctl status nginx
```

### **ШАГ 6: Установка дополнительных утилит**
```bash
apt install -y git curl wget unzip
```

### **ШАГ 7: Настройка файрвола**
```bash
apt install ufw -y
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80
ufw allow 443
ufw enable
ufw status
```

### **ШАГ 8: Создание директории и клонирование**
```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/Alex2516439780/GavharMenu3.git
cd GavharMenu3
```

### **ШАГ 9: Установка зависимостей проекта**
```bash
npm install --production
```

### **ШАГ 10: Инициализация базы данных**
```bash
npm run init-db
```

### **ШАГ 11: Создание .env файла**
```bash
cp env.example .env
nano .env
```

**В файле .env измените:**
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

### **ШАГ 12: Настройка прав доступа**
```bash
chmod 755 uploads/
chmod 755 backups/
chmod 755 logs/
chmod 644 database.sqlite
chmod 644 .env
```

### **ШАГ 13: Запуск приложения**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
pm2 status
```

### **ШАГ 14: Создание конфигурации Nginx**
```bash
nano /etc/nginx/sites-available/gavhar
```

**Вставьте в файл:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    root /var/www/GavharMenu3/public;
    index index.html;

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \.(css|js|jpg|jpeg|png|gif|webp|avif|woff2|ttf|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### **ШАГ 15: Активация сайта**
```bash
ln -s /etc/nginx/sites-available/gavhar /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### **ШАГ 16: Установка SSL (опционально)**
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com -d www.your-domain.com
```

### **ШАГ 17: Проверка работы**
```bash
pm2 status
systemctl status nginx
curl http://localhost:3000/api/health
curl http://your-domain.com
```

### **ШАГ 18: Готово!**
Ваше приложение доступно по адресу:
- **HTTP:** http://your-domain.com
- **API:** http://your-domain.com/api
- **Админка:** http://your-domain.com/admin.html

---

## 🔧 Полезные команды для управления

### **Управление приложением:**
```bash
pm2 status          # Статус
pm2 logs gavhar     # Логи
pm2 restart gavhar  # Перезапуск
pm2 stop gavhar     # Остановка
pm2 monit           # Мониторинг
```

### **Управление Nginx:**
```bash
systemctl status nginx    # Статус
systemctl restart nginx   # Перезапуск
systemctl reload nginx    # Перезагрузка
nginx -t                  # Проверка конфигурации
```

### **Обновление приложения:**
```bash
cd /var/www/GavharMenu3
pm2 stop gavhar
git pull origin main
npm install --production
pm2 start gavhar
```

---

## ✅ Готово!

Выполняйте команды по порядку, и ваше приложение будет работать на VPS сервере!
