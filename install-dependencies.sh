#!/bin/bash

# 🚀 Скрипт автоматической установки зависимостей для GAVHAR Restaurant
# Запуск: chmod +x install-dependencies.sh && ./install-dependencies.sh

set -e  # Остановка при ошибке

echo "🚀 Начинаем установку зависимостей для GAVHAR Restaurant..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка прав root
if [[ $EUID -eq 0 ]]; then
   print_error "Не запускайте этот скрипт от имени root! Используйте sudo при необходимости."
   exit 1
fi

print_status "Обновление системы..."
sudo apt update && sudo apt upgrade -y

print_status "Установка базовых утилит..."
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

print_status "Установка Node.js 18 LTS..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка версии Node.js
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_success "Node.js установлен: $NODE_VERSION"
print_success "npm установлен: $NPM_VERSION"

print_status "Установка PM2..."
sudo npm install -g pm2

# Проверка версии PM2
PM2_VERSION=$(pm2 --version)
print_success "PM2 установлен: $PM2_VERSION"

print_status "Установка Nginx..."
sudo apt install nginx -y

# Запуск и автозапуск Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
print_success "Nginx установлен и запущен"

print_status "Установка дополнительных зависимостей..."
sudo apt install -y imagemagick gzip unzip zip htop iotop

print_status "Настройка файрвола..."
sudo apt install ufw -y
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
print_success "Файрвол настроен"

print_status "Создание директорий..."
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
sudo mkdir -p /var/log/gavhar
sudo chown -R $USER:$USER /var/log/gavhar
print_success "Директории созданы"

print_status "Клонирование репозитория..."
cd /var/www
if [ -d "GavharMenu3" ]; then
    print_warning "Директория GavharMenu3 уже существует. Обновляем..."
    cd GavharMenu3
    git pull origin main
else
    git clone https://github.com/Alex2516439780/GavharMenu3.git
    cd GavharMenu3
fi

print_status "Установка зависимостей проекта..."
npm install --production
print_success "Зависимости проекта установлены"

print_status "Инициализация базы данных..."
npm run init-db
print_success "База данных инициализирована"

print_status "Настройка прав доступа..."
chmod 755 uploads/
chmod 755 backups/
chmod 755 logs/
chmod 644 database.sqlite 2>/dev/null || true
print_success "Права доступа настроены"

print_status "Создание .env файла..."
if [ ! -f .env ]; then
    cp env.example .env
    print_warning "Создан файл .env из примера. ОБЯЗАТЕЛЬНО настройте его!"
    print_warning "Отредактируйте файл: nano .env"
else
    print_success "Файл .env уже существует"
fi

print_status "Запуск приложения с PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup
print_success "Приложение запущено с PM2"

print_status "Создание конфигурации Nginx..."
sudo tee /etc/nginx/sites-available/gavhar > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;
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
EOF

# Активация сайта
sudo ln -sf /etc/nginx/sites-available/gavhar /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
print_success "Nginx настроен"

print_status "Установка Certbot для SSL..."
sudo apt install certbot python3-certbot-nginx -y
print_success "Certbot установлен"

echo ""
echo "🎉 Установка завершена успешно!"
echo ""
echo "📋 Что нужно сделать дальше:"
echo "1. Настройте .env файл: nano /var/www/GavharMenu3/.env"
echo "2. Настройте домен в Nginx: sudo nano /etc/nginx/sites-available/gavhar"
echo "3. Получите SSL сертификат: sudo certbot --nginx -d your-domain.com"
echo "4. Проверьте статус: pm2 status"
echo ""
echo "🔗 Ваше приложение доступно по адресу:"
echo "   - HTTP: http://$(curl -s ifconfig.me)"
echo "   - API: http://$(curl -s ifconfig.me)/api"
echo "   - Админка: http://$(curl -s ifconfig.me)/admin.html"
echo ""
echo "📊 Полезные команды:"
echo "   - pm2 status          # Статус приложения"
echo "   - pm2 logs gavhar     # Логи приложения"
echo "   - pm2 restart gavhar  # Перезапуск"
echo "   - sudo systemctl status nginx  # Статус Nginx"
echo ""
print_success "Установка завершена! 🚀"
