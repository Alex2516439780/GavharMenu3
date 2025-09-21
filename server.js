const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const database = require('./models/database');
const fs = require('fs');
require('dotenv').config();
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('etag', 'strong');

// Production check
const isProduction = process.env.NODE_ENV === 'production';

// Ensure required directories exist (data/uploads)
try {
    const cfg = require('./config');
    const dataDir = path.dirname(cfg.DB_PATH);
    if (dataDir && !fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (cfg.UPLOAD_PATH && !fs.existsSync(cfg.UPLOAD_PATH)) fs.mkdirSync(cfg.UPLOAD_PATH, { recursive: true });
} catch(_) {}

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
        },
    },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' }
}));

// HSTS в проде (только если HTTPS)
if (isProduction) {
    app.use((req, res, next) => {
        res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains'); // 180 дней
        next();
    });
}
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting (enabled only in production)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 600, // per-IP limit (tune as needed for production)
    standardHeaders: true,
    legacyHeaders: false
});
if (isProduction) {
    app.use('/api/', limiter);
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Light API caching for GET endpoints
app.use((req, res, next) => {
    if (req.method === 'GET' && req.path.startsWith('/api/')) {
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=120');
        res.set('Vary', 'Accept-Encoding');
    }
    next();
});

// Лог долгих запросов к API
app.use('/api', (req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - startedAt;
        if (ms > 300) {
            console.warn(`[slow] ${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
        }
    });
    next();
});

// Compression (Brotli + Gzip)
app.use(compression());

// Serve static files
const staticOptions = {
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        // No cache for HTML files in development
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|avif|ico|ttf|woff|woff2)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
};
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), staticOptions));
app.use(express.static(path.join(__dirname, 'public'), staticOptions));

// Routes
// Redirect legacy restaurant page to unified menu with params
app.get(['/restaurant', '/restaurant.html'], (req, res) => {
    const params = new URLSearchParams(req.query);
    if (!params.has('restaurant')) params.set('restaurant', 'true');
    if (!params.has('service')) params.set('service', '15');
    const qs = params.toString();
    res.redirect(302, `/menu.html${qs ? `?${qs}` : ''}`);
});

app.use('/api/categories', require('./routes/categories'));
app.use('/api/dishes', require('./routes/dishes'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/upload', require('./routes/upload'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Внутренняя ошибка сервера',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Что-то пошло не так'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Маршрут не найден'
    });
});

// Инициализация базы данных и запуск сервера
async function startServer() {
    try {
        await database.init();
        console.log('✅ База данных подключена');

        const server = app.listen(PORT, () => {
            console.log(`🚀 Сервер запущен на порту ${PORT}`);
            console.log(`📱 Фронтенд: http://localhost:${PORT}`);
            console.log(`🔧 API: http://localhost:${PORT}/api`);
            console.log(`🔑 Админ-панель: http://localhost:${PORT}/admin.html`);
        });

        // Грейсфул-шатдаун
        const shutdown = async (signal) => {
            try {
                console.log(`\n${signal} получен. Завершаю работу...`);
                server.close(() => console.log('HTTP сервер остановлен'));
                await database.close();
                process.exit(0);
            } catch (e) {
                console.error('Ошибка при завершении:', e);
                process.exit(1);
            }
        };
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('uncaughtException', (err) => {
            console.error('uncaughtException:', err);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('unhandledRejection:', reason);
        });

        // Автоматический ежедневный бэкап БД (по умолчанию включен в проде)
        const enableBackup = process.env.BACKUP_ENABLED !== 'false';
        if (enableBackup) {
            scheduleDailyBackup();
        }
    } catch (error) {
        console.error('❌ Ошибка запуска сервера:', error);
        process.exit(1);
    }
}

startServer();

module.exports = app;

// ===== Вспомогательные функции =====
function scheduleDailyBackup() {
    try {
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        // первый бэкап через 10 секунд после старта, затем каждые сутки
        setTimeout(backupDatabase, 10 * 1000);
        setInterval(backupDatabase, ONE_DAY_MS);
        console.log('🗄️ Планировщик бэкапа БД запущен (ежедневно)');
    } catch (e) {
        console.warn('Не удалось запустить планировщик бэкапа:', e.message);
    }
}

function backupDatabase() {
    try {
        const dbPath = require('./config').DB_PATH;
        const backupsDir = path.join(__dirname, 'backups');
        if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
        const ts = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const name = `${ts.getFullYear()}-${pad(ts.getMonth()+1)}-${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.sqlite`;
        const dest = path.join(backupsDir, name);
        fs.copyFile(dbPath, dest, (err) => {
            if (err) {
                console.error('Бэкап БД не удался:', err.message);
            } else {
                console.log('✅ Бэкап БД создан:', dest);
                rotateBackups(backupsDir, 14);
            }
        });
    } catch (e) {
        console.warn('Ошибка бэкапа БД:', e.message);
    }
}

function rotateBackups(dir, keep = 14) {
    try {
        const files = fs.readdirSync(dir)
            .filter(f => f.endsWith('.sqlite'))
            .map(f => ({ f, time: fs.statSync(path.join(dir, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);
        const toDelete = files.slice(keep);
        toDelete.forEach(({ f }) => {
            try { fs.unlinkSync(path.join(dir, f)); } catch(_) {}
        });
    } catch (_) {}
}
