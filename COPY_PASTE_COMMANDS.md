# 🖥️ Команды для копирования и вставки

## 📋 Выполняйте команды по порядку

### **ШАГ 1: Подключение к серверу**
```bash
ssh root@your-server-ip
```

### **ШАГ 2: Обновление системы**
```bash
apt update
```
```bash
apt upgrade -y
```

### **ШАГ 3: Установка Node.js 18**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
```
```bash
apt-get install -y nodejs
```
```bash
node --version
```
```bash
npm --version
```

### **ШАГ 4: Установка PM2**
```bash
npm install -g pm2
```
```bash
pm2 --version
```

### **ШАГ 5: Установка Nginx**
```bash
apt install nginx -y
```
```bash
systemctl start nginx
```
```bash
systemctl enable nginx
```
```bash
systemctl status nginx
```

### **ШАГ 6: Установка дополнительных утилит**
```bash
apt install -y git curl wget unzip
```

### **ШАГ 7: Настройка файрвола**
```bash
apt install ufw -y
```
```bash
ufw default deny incoming
```
```bash
ufw default allow outgoing
```
```bash
ufw allow ssh
```
```bash
ufw allow 80
```
```bash
ufw allow 443
```
```bash
ufw enable
```
```bash
ufw status
```

### **ШАГ 8: Создание директории и клонирование**
```bash
mkdir -p /var/www
```
```bash
cd /var/www
```
```bash
git clone https://github.com/Alex2516439780/GavharMenu3.git
```
```bash
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
```
```bash
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
```
```bash
chmod 755 backups/
```
```bash
chmod 755 logs/
```
```bash
chmod 644 database.sqlite
```
```bash
chmod 644 .env
```

### **ШАГ 13: Запуск приложения**
```bash
pm2 start ecosystem.config.js
```
```bash
pm2 save
```
```bash
pm2 startup
```
```bash
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
```
```bash
rm /etc/nginx/sites-enabled/default
```
```bash
nginx -t
```
```bash
systemctl restart nginx
```

### **ШАГ 16: Установка SSL (опционально)**
```bash
apt install certbot python3-certbot-nginx -y
```
```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

### **ШАГ 17: Проверка работы**
```bash
pm2 status
```
```bash
systemctl status nginx
```
```bash
curl http://localhost:3000/api/health
```
```bash
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
pm2 status
```
```bash
pm2 logs gavhar
```
```bash
pm2 restart gavhar
```
```bash
pm2 stop gavhar
```
```bash
pm2 monit
```

### **Управление Nginx:**
```bash
systemctl status nginx
```
```bash
systemctl restart nginx
```
```bash
systemctl reload nginx
```
```bash
nginx -t
```

### **Обновление приложения:**
```bash
cd /var/www/GavharMenu3
```
```bash
pm2 stop gavhar
```
```bash
git pull origin main
```
```bash
npm install --production
```
```bash
pm2 start gavhar
```

---

## ✅ Готово!

Выполняйте команды по порядку, и ваше приложение будет работать на VPS сервере!
