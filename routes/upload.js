const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const sharp = require('sharp');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(config.UPLOAD_PATH, 'dishes');

        // Создание папки если не существует
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Генерация уникального имени файла
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `dish-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    // Проверка типа файла
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Разрешены только изображения'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: config.MAX_FILE_SIZE
    },
    fileFilter: fileFilter
});

// Мягкий даунскейл: если изображение очень большое, уменьшаем до MAX_DIM по большей стороне
const MAX_DIM = 2000;
async function downscaleIfNeeded(fullPath) {
    try {
        const fs = require('fs');
        if (!fs.existsSync(fullPath)) {
            console.warn('Файл не существует, пропускаем даунскейл:', fullPath);
            return;
        }

        try {
            await fs.promises.access(fullPath, fs.constants.R_OK | fs.constants.W_OK);
        } catch (accessError) {
            console.warn('Файл заблокирован или недоступен для записи, пропускаем даунскейл:', fullPath);
            return;
        }

        const meta = await sharp(fullPath).metadata();
        const width = meta.width || 0;
        const height = meta.height || 0;
        if ((width > MAX_DIM) || (height > MAX_DIM)) {
            const buffer = await sharp(fullPath)
                .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
                .toBuffer();
            await fs.promises.writeFile(fullPath, buffer);
        }
    } catch (e) {
        if (e.code === 'EACCES' || e.code === 'EPERM') {
            console.warn('Нет прав доступа к файлу, пропускаем даунскейл:', fullPath);
        } else if (e.code === 'EBUSY') {
            console.warn('Файл занят другим процессом, пропускаем даунскейл:', fullPath);
        } else {
            console.warn('Не удалось выполнить даунскейл:', e.message, 'для файла:', fullPath);
        }
    }
}

// Загрузка одного изображения
router.post('/single', authenticateToken, requireAdmin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'Файл не был загружен'
            });
        }

        const imageUrl = `/uploads/dishes/${req.file.filename}`;
        let thumbUrl = null;

        // Генерация WebP/AVIF превью в фоне (не блокируем ответ)
        (async () => {
            try {
                const fullPath = path.join(config.UPLOAD_PATH, 'dishes', req.file.filename);
                // Отключено: больше не уменьшаем оригинал автоматически
                // Это сохраняет исходное качество без перезаписи файла
                const ext = path.extname(fullPath);
                const base = path.basename(fullPath, ext);
                const dir = path.dirname(fullPath);
                const sizes = [100, 200, 400, 800];
                for (const width of sizes) {
                    // Улучшенное качество для превью - используем более высокие настройки качества
                    await sharp(fullPath)
                        .resize({ width, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
                        .webp({ effort: 4, quality: 90, alphaQuality: 100, smartSubsample: true })
                        .toFile(path.join(dir, `${base}-${width}.webp`));

                    await sharp(fullPath)
                        .resize({ width, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
                        .avif({ effort: 4, quality: 80, chromaSubsampling: '4:4:4' })
                        .toFile(path.join(dir, `${base}-${width}.avif`));
                }
                // Используем превью 200px для лучшего качества в админ-панели
                thumbUrl = `/uploads/dishes/${base}-200.webp`;
            } catch (e) {
                console.warn('Не удалось сгенерировать превью:', e.message);
            }
        })();

        res.json({
            success: true,
            data: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                url: imageUrl,
                thumbUrl: thumbUrl,
                size: req.file.size
            },
            message: 'Изображение успешно загружено'
        });

    } catch (error) {
        console.error('Ошибка загрузки файла:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка загрузки файла'
        });
    }
});

// Загрузка нескольких изображений
router.post('/multiple', authenticateToken, requireAdmin, upload.array('images', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Файлы не были загружены'
            });
        }

        const uploadedFiles = req.files.map(file => ({
            filename: file.filename,
            originalName: file.originalname,
            url: `/uploads/dishes/${file.filename}`,
            size: file.size,
            thumbUrl: null
        }));

        // Фоновая генерация превью для каждого файла
        (async () => {
            for (const file of req.files) {
                try {
                    const fullPath = path.join(config.UPLOAD_PATH, 'dishes', file.filename);
                    // Отключено: больше не уменьшаем оригинал автоматически
                    const ext = path.extname(fullPath);
                    const base = path.basename(fullPath, ext);
                    const dir = path.dirname(fullPath);
                    const sizes = [100, 200, 400, 800];
                    for (const width of sizes) {
                        // Улучшенное качество для превью - используем более высокие настройки качества
                        await sharp(fullPath)
                            .resize({ width, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
                            .webp({ effort: 4, quality: 90, alphaQuality: 100, smartSubsample: true })
                            .toFile(path.join(dir, `${base}-${width}.webp`));

                        await sharp(fullPath)
                            .resize({ width, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
                            .avif({ effort: 4, quality: 80, chromaSubsampling: '4:4:4' })
                            .toFile(path.join(dir, `${base}-${width}.avif`));
                    }
                    const item = uploadedFiles.find(f => f.filename === file.filename);
                    // Используем превью 200px для лучшего качества в админ-панели
                    if (item) item.thumbUrl = `/uploads/dishes/${base}-200.webp`;
                } catch (e) {
                    console.warn('Не удалось сгенерировать превью для', file.filename, e.message);
                }
            }
        })();

        res.json({
            success: true,
            data: uploadedFiles,
            message: `${uploadedFiles.length} изображений успешно загружено`
        });

    } catch (error) {
        console.error('Ошибка загрузки файлов:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка загрузки файлов'
        });
    }
});

// Удаление изображения
router.delete('/:filename', authenticateToken, requireAdmin, (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(config.UPLOAD_PATH, 'dishes', filename);

        // Проверка существования файла
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                error: 'Файл не найден'
            });
        }

        // Удаление файла
        fs.unlinkSync(filePath);

        // Попробуем удалить связанные превью
        try {
            const ext = path.extname(filePath);
            const base = path.basename(filePath, ext);
            const dir = path.dirname(filePath);
            ['400', '800'].forEach(sz => {
                ['webp', 'avif'].forEach(fmt => {
                    const p = path.join(dir, `${base}-${sz}.${fmt}`);
                    if (fs.existsSync(p)) fs.unlinkSync(p);
                });
            });
        } catch (_) {}

        res.json({
            success: true,
            message: 'Файл успешно удален'
        });

    } catch (error) {
        console.error('Ошибка удаления файла:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка удаления файла'
        });
    }
});

// Middleware для обработки ошибок multer
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'Файл слишком большой. Максимальный размер: 15MB'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Слишком много файлов. Максимум: 10 файлов'
            });
        }
    }

    if (error.message === 'Разрешены только изображения') {
        return res.status(400).json({
            success: false,
            error: 'Разрешены только изображения'
        });
    }

    res.status(500).json({
        success: false,
        error: 'Ошибка загрузки файла'
    });
});

module.exports = router;
