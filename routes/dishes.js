const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const database = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Получить все блюда
router.get('/', async (req, res) => {
    try {
        const { category, subcategory, inStock, language = 'ru', restaurant, light } = req.query;
        // Параметры пагинации (опционально)
        let { limit, offset, page, pageSize } = req.query;
        const hasLimitOffset = (typeof limit !== 'undefined' || typeof page !== 'undefined');
        // Нормализация
        const maxLimit = 200;
        const ps = Math.min(parseInt(pageSize || limit || 24, 10) || 24, maxLimit);
        const pg = Math.max(parseInt(page || 1, 10) || 1, 1);
        const off = (typeof offset !== 'undefined') ? Math.max(parseInt(offset, 10) || 0, 0) : (pg - 1) * ps;
        const isLight = light === '1' || light === 'true';
        const allowAlcohol = restaurant === 'true' || req.headers['x-restaurant-mode'] === 'true';

        let sql = isLight
            ? `SELECT d.id, d.name_ru, d.name_uz, d.name_en, d.category_key, d.subcategory_key, d.price, d.order_index,
                       COALESCE(d.image, json_extract(d.images, '$[0]')) as image,
                       d.in_stock, d.is_alcoholic,
                       c.name_ru as category_name_ru, c.name_uz as category_name_uz, c.name_en as category_name_en
               FROM dishes d
               LEFT JOIN categories c ON d.category_key = c.key
               WHERE 1=1`
            : `SELECT d.*, c.name_ru as category_name_ru, c.name_uz as category_name_uz, c.name_en as category_name_en
               FROM dishes d
               LEFT JOIN categories c ON d.category_key = c.key
               WHERE 1=1`;
        const params = [];

        // Фильтр по категории
        if (category) {
            sql += ' AND d.category_key = ?';
            params.push(category);
        }

        // Фильтр по подкатегории
        if (subcategory) {
            sql += ' AND d.subcategory_key = ?';
            params.push(subcategory);
        }

        // Фильтр по наличию
        if (inStock === 'true') {
            sql += ' AND d.in_stock = 1';
        }

        // Фильтр алкоголя
        if (!allowAlcohol) {
            sql += ' AND d.is_alcoholic = 0';
        }

        sql += ' ORDER BY d.order_index, d.id';

        // Подсчёт общего количества при пагинации
        let total = null;
        if (hasLimitOffset) {
            let countSql = `SELECT COUNT(1) as cnt FROM dishes d WHERE 1=1`;
            const countParams = [];
            if (category) { countSql += ' AND d.category_key = ?'; countParams.push(category); }
            if (subcategory) { countSql += ' AND d.subcategory_key = ?'; countParams.push(subcategory); }
            if (inStock === 'true') { countSql += ' AND d.in_stock = 1'; }
            if (!allowAlcohol) { countSql += ' AND d.is_alcoholic = 0'; }
            const row = await database.get(countSql, countParams);
            total = row ? row.cnt : 0;
            sql += ' LIMIT ? OFFSET ?';
            params.push(ps, off);
        }

        const dishes = await database.all(sql, params);

        // Обработка результата
        const uploadsDirFs = path.join(config.UPLOAD_PATH, 'dishes');
        const chooseLightImage = (img) => {
            if (!img) return img;
            const isHttp = /^https?:\/\//i.test(img);
            if (isHttp) return img; // внешние оставляем как есть

            // Нормализуем URL
            const urlPath = img.startsWith('/') ? img : `/${img}`;
            const dirUrl = urlPath.substring(0, urlPath.lastIndexOf('/'));
            const baseName = path.basename(urlPath).split('?')[0];

            // Вычислим "корень" имени без суффикса размера и без расширения
            const dot = baseName.lastIndexOf('.');
            const nameWithoutExt = dot > -1 ? baseName.substring(0, dot) : baseName;
            const rootName = nameWithoutExt.replace(/-(100|200|400)$/i, '');

            // Предпочтительно отдаём 800px превью, затем оригинал
            const candidateAvif800Fs = path.join(uploadsDirFs, `${rootName}-800.avif`);
            const candidateWebp800Fs = path.join(uploadsDirFs, `${rootName}-800.webp`);
            if (fs.existsSync(candidateAvif800Fs)) return `${dirUrl}/${rootName}-800.avif`;
            if (fs.existsSync(candidateWebp800Fs)) return `${dirUrl}/${rootName}-800.webp`;

            // Если 800 нет — попробуем 400 как запасной вариант
            const candidateAvif400Fs = path.join(uploadsDirFs, `${rootName}-400.avif`);
            const candidateWebp400Fs = path.join(uploadsDirFs, `${rootName}-400.webp`);
            if (fs.existsSync(candidateAvif400Fs)) return `${dirUrl}/${rootName}-400.avif`;
            if (fs.existsSync(candidateWebp400Fs)) return `${dirUrl}/${rootName}-400.webp`;

            // В остальных случаях возвращаем оригинал без изменений
            return urlPath;
        };

        const processedDishes = dishes.map(dish => {
            const base = {
                id: dish.id,
                name: { ru: dish.name_ru, uz: dish.name_uz, en: dish.name_en },
                category: dish.category_key,
                subcategory: dish.subcategory_key,
                price: dish.price,
                order: dish.order_index,
                image: isLight ? chooseLightImage(dish.image || null) : dish.image,
                inStock: Boolean(dish.in_stock),
                isAlcoholic: Boolean(dish.is_alcoholic),
                categoryName: {
                    ru: dish.category_name_ru,
                    uz: dish.category_name_uz,
                    en: dish.category_name_en
                }
            };

            if (isLight) {
                return { ...base, __light: true };
            }

            const images = dish.images ? JSON.parse(dish.images) : [];
            return {
                ...base,
                images,
                composition: {
                    ru: dish.composition_ru || '',
                    uz: dish.composition_uz || '',
                    en: dish.composition_en || ''
                },
                weight: dish.weight || '',
                cookingTime: dish.cooking_time || ''
            };
        });

        const response = { success: true, data: processedDishes };
        if (hasLimitOffset) {
            response.total = total;
            response.limit = ps;
            response.offset = off;
            response.page = Math.floor(off / ps) + 1;
            response.pageSize = ps;
        }

        // ETag / If-None-Match
        const etag = '"' + crypto.createHash('sha1').update(JSON.stringify(response)).digest('hex') + '"';
        if (req.headers['if-none-match'] && req.headers['if-none-match'] === etag) {
            res.set('ETag', etag);
            return res.status(304).end();
        }
        res.set('ETag', etag).json(response);

    } catch (error) {
        console.error('Ошибка получения блюд:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения блюд'
        });
    }
});

// Получить блюдо по ID
router.get('/:id(\\d+)', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('API: Loading dish with ID:', id);

        const dish = await database.get(
            `SELECT d.*, c.name_ru as category_name_ru, c.name_uz as category_name_uz, c.name_en as category_name_en
             FROM dishes d
             LEFT JOIN categories c ON d.category_key = c.key
             WHERE d.id = ?`,
            [id]
        );

        if (!dish) {
            return res.status(404).json({
                success: false,
                error: 'Блюдо не найдено'
            });
        }

        const images = dish.images ? JSON.parse(dish.images) : [];

        res.json({
            success: true,
            data: {
                id: dish.id,
                name: {
                    ru: dish.name_ru,
                    uz: dish.name_uz,
                    en: dish.name_en
                },
                category: dish.category_key,
                subcategory: dish.subcategory_key,
                price: dish.price,
                order: dish.order_index,
                image: dish.image,
                images: images,
                composition: {
                    ru: dish.composition_ru || '',
                    uz: dish.composition_uz || '',
                    en: dish.composition_en || ''
                },
                weight: dish.weight || '',
                cookingTime: dish.cooking_time || '',
                inStock: Boolean(dish.in_stock),
                isAlcoholic: Boolean(dish.is_alcoholic),
                categoryName: {
                    ru: dish.category_name_ru,
                    uz: dish.category_name_uz,
                    en: dish.category_name_en
                }
            }
        });

    } catch (error) {
        console.error('Ошибка получения блюда:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения блюда'
        });
    }
});

// Поиск блюд
router.get('/search', async (req, res) => {
    try {
        const { q, language = 'ru', restaurant } = req.query;
        const allowAlcohol = restaurant === 'true' || req.headers['x-restaurant-mode'] === 'true';

        if (!q) {
            return res.json({
                success: true,
                data: []
            });
        }

        // Попытка выполнить быстрый поиск через FTS5, если доступен
        let sql = `
            SELECT d.*, c.name_ru as category_name_ru, c.name_uz as category_name_uz, c.name_en as category_name_en
            FROM dishes d
            LEFT JOIN categories c ON d.category_key = c.key
            WHERE d.id IN (
                SELECT rowid FROM dishes_fts WHERE dishes_fts MATCH ?
            )
        `;
        const params = [q.replace(/[\s]+/g, ' ')];

        // Фильтр алкоголя
        if (!allowAlcohol) {
            sql += ' AND d.is_alcoholic = 0';
        }

        sql += ' ORDER BY d.order_index, d.id';

        let dishes = [];
        try {
            dishes = await database.all(sql, params);
        } catch (e) {
            // FTS5 может быть недоступен — обратно на LIKE-стратегию
            sql = `
                SELECT d.*, c.name_ru as category_name_ru, c.name_uz as category_name_uz, c.name_en as category_name_en
                FROM dishes d
                LEFT JOIN categories c ON d.category_key = c.key
                WHERE (
                    LOWER(d.name_ru) LIKE LOWER(?) OR
                    LOWER(d.name_uz) LIKE LOWER(?) OR
                    LOWER(d.name_en) LIKE LOWER(?) OR
                    LOWER(d.composition_ru) LIKE LOWER(?) OR
                    LOWER(d.composition_uz) LIKE LOWER(?) OR
                    LOWER(d.composition_en) LIKE LOWER(?)
                )
            `;
            dishes = await database.all(sql, [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]);
        }

        // Если БД вернула пусто, но запрос не пустой, сделаем страхующий фильтр на Node.js
        let resultRows = dishes;
        if (Array.isArray(resultRows) && resultRows.length === 0) {
            const allSql = `
                SELECT d.*, c.name_ru as category_name_ru, c.name_uz as category_name_uz, c.name_en as category_name_en
                FROM dishes d
                LEFT JOIN categories c ON d.category_key = c.key
                ${!allowAlcohol ? 'WHERE d.is_alcoholic = 0' : ''}
            `;
            const allRows = await database.all(allSql, []);
            const qLower = String(q).toLocaleLowerCase('ru-RU');
            resultRows = allRows.filter(d => {
                const nameRu = (d.name_ru || '').toLocaleLowerCase('ru-RU');
                const nameUz = (d.name_uz || '').toLocaleLowerCase('ru-RU');
                const nameEn = (d.name_en || '').toLocaleLowerCase('en-US');
                const compRu = (d.composition_ru || '').toLocaleLowerCase('ru-RU');
                const compUz = (d.composition_uz || '').toLocaleLowerCase('ru-RU');
                const compEn = (d.composition_en || '').toLocaleLowerCase('en-US');
                return (
                    nameRu.includes(qLower) ||
                    nameUz.includes(qLower) ||
                    nameEn.includes(qLower) ||
                    compRu.includes(qLower) ||
                    compUz.includes(qLower) ||
                    compEn.includes(qLower)
                );
            });
        }

        // Обработка результата
        const processedDishes = resultRows.map(dish => {
            const images = dish.images ? JSON.parse(dish.images) : [];

            return {
                id: dish.id,
                name: {
                    ru: dish.name_ru,
                    uz: dish.name_uz,
                    en: dish.name_en
                },
                category: dish.category_key,
                subcategory: dish.subcategory_key,
                price: dish.price,
                order: dish.order_index,
                image: dish.image,
                images: images,
                composition: {
                    ru: dish.composition_ru || '',
                    uz: dish.composition_uz || '',
                    en: dish.composition_en || ''
                },
                weight: dish.weight || '',
                cookingTime: dish.cooking_time || '',
                inStock: Boolean(dish.in_stock),
                isAlcoholic: Boolean(dish.is_alcoholic),
                categoryName: {
                    ru: dish.category_name_ru,
                    uz: dish.category_name_uz,
                    en: dish.category_name_en
                }
            };
        });

        res.json({
            success: true,
            data: processedDishes
        });

    } catch (error) {
        console.error('Ошибка поиска блюд:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка поиска блюд'
        });
    }
});

// Создать блюдо (только для админов)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name,
            category,
            subcategory,
            price,
            order = 0,
            image,
            images = [],
            composition,
            weight,
            cookingTime,
            inStock = true,
            isAlcoholic = false
        } = req.body;

        if (!name || !name.ru || !name.uz || !name.en) {
            return res.status(400).json({
                success: false,
                error: 'Названия на всех языках обязательны'
            });
        }

        if (!category || !price) {
            return res.status(400).json({
                success: false,
                error: 'Категория и цена обязательны'
            });
        }

        // Проверка существования категории
        const categoryExists = await database.get(
            'SELECT id FROM categories WHERE key = ?',
            [category]
        );

        if (!categoryExists) {
            return res.status(400).json({
                success: false,
                error: 'Категория не найдена'
            });
        }

        // Создание блюда
        const result = await database.run(
            `INSERT INTO dishes (
                name_ru, name_uz, name_en, category_key, subcategory_key, price, order_index,
                image, images, composition_ru, composition_uz, composition_en,
                weight, cooking_time, in_stock, is_alcoholic
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name.ru, name.uz, name.en, category, subcategory, price, order,
                image, JSON.stringify(images),
                composition?.ru || '', composition?.uz || '', composition?.en || '',
                weight || '', cookingTime || '', inStock ? 1 : 0, isAlcoholic ? 1 : 0
            ]
        );

        res.status(201).json({
            success: true,
            data: { id: result.id },
            message: 'Блюдо успешно создано'
        });

    } catch (error) {
        console.error('Ошибка создания блюда:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка создания блюда'
        });
    }
});

// Обновить блюдо (только для админов)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            category,
            subcategory,
            price,
            order,
            image,
            images,
            composition,
            weight,
            cookingTime,
            inStock,
            isAlcoholic
        } = req.body;

        // Проверка существования блюда
        const existingDish = await database.get(
            'SELECT id FROM dishes WHERE id = ?',
            [id]
        );

        if (!existingDish) {
            return res.status(404).json({
                success: false,
                error: 'Блюдо не найдено'
            });
        }

        // Обновление блюда
        await database.run(
            `UPDATE dishes SET
                name_ru = ?, name_uz = ?, name_en = ?, category_key = ?, subcategory_key = ?,
                price = ?, order_index = ?, image = ?, images = ?, composition_ru = ?,
                composition_uz = ?, composition_en = ?, weight = ?, cooking_time = ?,
                in_stock = ?, is_alcoholic = ?
             WHERE id = ?`,
            [
                name.ru, name.uz, name.en, category, subcategory, price, order,
                image, JSON.stringify(images || []), composition?.ru || '',
                composition?.uz || '', composition?.en || '', weight || '',
                cookingTime || '', inStock ? 1 : 0, isAlcoholic ? 1 : 0, id
            ]
        );

        res.json({
            success: true,
            message: 'Блюдо успешно обновлено'
        });

    } catch (error) {
        console.error('Ошибка обновления блюда:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка обновления блюда'
        });
    }
});

// Удалить блюдо (только для админов)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка существования блюда
        const existingDish = await database.get(
            'SELECT id FROM dishes WHERE id = ?',
            [id]
        );

        if (!existingDish) {
            return res.status(404).json({
                success: false,
                error: 'Блюдо не найдено'
            });
        }

        // Удаление блюда
        await database.run('DELETE FROM dishes WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Блюдо успешно удалено'
        });

    } catch (error) {
        console.error('Ошибка удаления блюда:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка удаления блюда'
        });
    }
});

// Переключить статус блюда (только для админов)
router.patch('/:id/toggle-status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Toggle status request for dish ID:', id);

        // Получение текущего статуса
        const dish = await database.get(
            'SELECT in_stock FROM dishes WHERE id = ?',
            [id]
        );

        console.log('Current dish status:', dish);

        if (!dish) {
            console.log('Dish not found');
            return res.status(404).json({
                success: false,
                error: 'Блюдо не найдено'
            });
        }

        // Переключение статуса
        const newStatus = dish.in_stock ? 0 : 1;
        console.log('New status will be:', newStatus);

        const result = await database.run(
            'UPDATE dishes SET in_stock = ? WHERE id = ?',
            [newStatus, id]
        );

        console.log('Update result:', result);

        res.json({
            success: true,
            data: { inStock: Boolean(newStatus) },
            message: `Блюдо ${newStatus ? 'доступно' : 'недоступно'}`
        });

    } catch (error) {
        console.error('Ошибка переключения статуса блюда:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Ошибка переключения статуса блюда'
        });
    }
});

module.exports = router;
