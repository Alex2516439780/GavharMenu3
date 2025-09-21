# 🚀 Руководство по развертыванию на сервере

## ⚠️ Потенциальные проблемы и их решения

### 1. 🔗 API Endpoints - КРИТИЧНО!

**Проблема**: Ваш проект использует API endpoints, которые должны работать на сервере:
- `/api/categories` - загрузка категорий
- `/api/dishes` - загрузка блюд  
- `/api/dishes/search` - поиск блюд
- `/api/dishes/{id}` - детали блюда
- `/api/upload/` - загрузка изображений (админка)

**Решение**: 
```javascript
// В script.js нужно настроить правильный API_BASE
const API_BASE = window.location.hostname === 'localhost' 
    ? '/api' 
    : 'https://your-server.com/api'; // замените на ваш домен
```

### 2. 📁 Пути к файлам

**Проблема**: Абсолютные пути могут не работать
**Текущие проблемные пути**:
- `/ELEMENTS/image 2.png` (fallback изображение)
- `/ELEMENTS/favicon/` (иконки)
- `/FONT/` (шрифты)

**Решение**: Убедитесь что структура папок сохранена на сервере.

### 3. 🖼️ Оптимизация изображений

**Текущее состояние**: Система оптимизирована для Unsplash API
**Для сервера нужно**:

#### A) Если используете локальные изображения:
Создайте несколько размеров для каждого изображения:
```
/images/dish1-300.webp  (мобильные)
/images/dish1-400.webp  (планшеты) 
/images/dish1-600.webp  (десктоп)
/images/dish1-300.jpg   (fallback)
/images/dish1-400.jpg   (fallback)
/images/dish1-600.jpg   (fallback)
```

#### B) Если используете CDN (рекомендуется):
- Cloudinary
- ImageKit
- AWS CloudFront

### 4. 🔧 Service Worker

**Проблема**: Service Worker кэширует старые версии
**Решение**: Обновите версию кэша в `sw.js`:
```javascript
const CACHE_NAME = 'gavhar-static-v3'; // увеличьте версию
```

### 5. 🌐 CORS проблемы

**Проблема**: Внешние изображения могут блокироваться CORS
**Решение**: Настройте сервер:
```nginx
# Nginx
location ~* \.(jpg|jpeg|png|gif|webp|avif)$ {
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
}
```

## 📋 Чек-лист перед развертыванием

### ✅ Файлы для загрузки на сервер:
```
public/
├── index.html ✓
├── styles.css ✓  
├── script.js ✓
├── api.js ✓
├── sw.js ✓
├── manifest.webmanifest ✓
├── ELEMENTS/ ✓
│   ├── image 2.png
│   ├── favicon/
│   └── Gavhar logo-02 13.png
├── FONT/ ✓
│   └── Athena-Regular (PERSONAL USE ONLY).woff2
└── admin files (если нужна админка)
```

### ✅ Настройки сервера:

#### 1. **Nginx конфигурация**:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/your/project/public;
    index index.html;

    # Кэширование статических файлов
    location ~* \.(css|js|jpg|jpeg|png|gif|webp|avif|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin *;
    }

    # API проксирование (если API на другом порту)
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache";
    }

    # Fallback для SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### 2. **Apache .htaccess**:
```apache
# Кэширование
<IfModule mod_expires.c>
    ExpiresActive on
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
</IfModule>

# CORS для изображений
<IfModule mod_headers.c>
    <FilesMatch "\.(jpg|jpeg|png|gif|webp|avif)$">
        Header set Access-Control-Allow-Origin "*"
    </FilesMatch>
</IfModule>

# Сжатие
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript
</IfModule>
```

## 🔧 Изменения в коде для сервера

### 1. Обновите API_BASE в script.js:
```javascript
// Замените эту строку:
const API_BASE = '/api';

// На эту (адаптивную):
const API_BASE = window.location.hostname === 'localhost' 
    ? '/api' 
    : `${window.location.protocol}//${window.location.hostname}/api`;
```

### 2. Добавьте обработку ошибок сети:
```javascript
// В функцию loadData() добавьте таймауты
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 сек

fetch(url, { 
    cache: 'no-cache',
    signal: controller.signal 
});
```

## 🚀 Оптимизации для продакшена

### 1. **Минификация** (обязательно!):
Обновите минифицированные версии:
- `script.min.js` ← из `script.js`
- `styles.min.css` ← из `styles.css`
- `api.min.js` ← из `api.js`

### 2. **Сжатие изображений**:
```bash
# Пример команд для оптимизации
cwebp -q 80 input.jpg -o output.webp
avifenc --min 20 --max 50 input.jpg output.avif
```

### 3. **CDN настройка**:
```javascript
// Если используете CDN
const CDN_BASE = 'https://cdn.your-domain.com';
const imageUrl = `${CDN_BASE}/images/dish-${id}.webp`;
```

## 📊 Мониторинг производительности

### Инструменты для проверки:
- **Google PageSpeed Insights**
- **GTmetrix** 
- **WebPageTest**
- **Chrome DevTools** (Network, Performance)

### Ключевые метрики:
- **LCP** (Largest Contentful Paint) < 2.5s
- **FID** (First Input Delay) < 100ms  
- **CLS** (Cumulative Layout Shift) < 0.1
- **TTFB** (Time to First Byte) < 600ms

## 🛠️ Устранение неполадок

### Если изображения загружаются медленно:

1. **Проверьте сжатие сервера**:
```bash
curl -H "Accept-Encoding: gzip" -I https://your-site.com/styles.css
```

2. **Включите HTTP/2**:
```nginx
listen 443 ssl http2;
```

3. **Настройте preload для критических ресурсов**:
```html
<link rel="preload" as="image" href="/ELEMENTS/image 2.png">
```

### Если API не работает:
1. Проверьте CORS настройки
2. Убедитесь что API сервер запущен
3. Проверьте пути в Network tab браузера

### Если Service Worker не обновляется:
1. Увеличьте версию кэша в `sw.js`
2. Добавьте `Cache-Control: no-cache` для `sw.js`
3. Очистите кэш браузера

## 🎯 Финальная проверка

После развертывания проверьте:
- [ ] Главная страница загружается
- [ ] Изображения отображаются корректно
- [ ] API endpoints отвечают
- [ ] Мобильная версия работает
- [ ] Service Worker регистрируется
- [ ] Кэширование работает
- [ ] Поиск функционирует
- [ ] Модальные окна открываются
- [ ] Корзина сохраняется

## 📞 Поддержка

При возникновении проблем:
1. Проверьте Console в DevTools
2. Проверьте Network tab на ошибки
3. Проверьте Application → Service Workers
4. Проверьте lighthouse audit

**Удачного развертывания! 🚀**
