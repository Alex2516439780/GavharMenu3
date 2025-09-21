const express = require('express');
const crypto = require('crypto');
const database = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Получить все категории
router.get('/', async (req, res) => {
    try {
        const { restaurant } = req.query;
        const allowAlcohol = restaurant === 'true' || req.headers['x-restaurant-mode'] === 'true';

        let sql = `
            SELECT
                c.*,
                GROUP_CONCAT(
                    json_object(
                        'id', s.id,
                        'key', s.key,
                        'name', json_object(
                            'ru', s.name_ru,
                            'uz', s.name_uz,
                            'en', s.name_en
                        )
                    )
                ) as subcategories_json
            FROM categories c
            LEFT JOIN subcategories s ON c.id = s.category_id
        `;

        const params = [];

        if (!allowAlcohol) {
            sql += ' WHERE c.is_alcoholic = 0';
        }

        sql += ' GROUP BY c.id ORDER BY c.order_index, c.id';

        const categories = await database.all(sql, params);

        // Обработка результата
        const processedCategories = categories.map(category => {
            const subcategories = category.subcategories_json
                ? JSON.parse(`[${category.subcategories_json}]`)
                : [];

            return {
                id: category.id,
                key: category.key,
                name: {
                    ru: category.name_ru,
                    uz: category.name_uz,
                    en: category.name_en
                },
                isAlcoholic: Boolean(category.is_alcoholic),
                subcategories: subcategories
            };
        });

        const response = { success: true, data: processedCategories };
        const etag = '"' + crypto.createHash('sha1').update(JSON.stringify(response)).digest('hex') + '"';
        if (req.headers['if-none-match'] && req.headers['if-none-match'] === etag) {
            res.set('ETag', etag);
            return res.status(304).end();
        }
        res.set('ETag', etag).json(response);

    } catch (error) {
        console.error('Ошибка получения категорий:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения категорий'
        });
    }
});

// Получить категорию по ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const category = await database.get(
            'SELECT * FROM categories WHERE id = ?',
            [id]
        );

        if (!category) {
            return res.status(404).json({
                success: false,
                error: 'Категория не найдена'
            });
        }

        // Получение подкатегорий
        const subcategories = await database.all(
            'SELECT * FROM subcategories WHERE category_id = ? ORDER BY order_index, id',
            [id]
        );

        const processedSubcategories = subcategories.map(sub => ({
            id: sub.id,
            key: sub.key,
            name: {
                ru: sub.name_ru,
                uz: sub.name_uz,
                en: sub.name_en
            }
        }));

        res.json({
            success: true,
            data: {
                id: category.id,
                key: category.key,
                name: {
                    ru: category.name_ru,
                    uz: category.name_uz,
                    en: category.name_en
                },
                isAlcoholic: Boolean(category.is_alcoholic),
                subcategories: processedSubcategories
            }
        });

    } catch (error) {
        console.error('Ошибка получения категории:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения категории'
        });
    }
});

// Создать категорию (только для админов)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { key, name, isAlcoholic = false, subcategories = [] } = req.body;

        if (!key || !name || !name.ru || !name.uz || !name.en) {
            return res.status(400).json({
                success: false,
                error: 'Ключ и названия на всех языках обязательны'
            });
        }

        // Проверка уникальности ключа
        const existingCategory = await database.get(
            'SELECT id FROM categories WHERE key = ?',
            [key]
        );

        if (existingCategory) {
            return res.status(400).json({
                success: false,
                error: 'Категория с таким ключом уже существует'
            });
        }

        // Создание категории
        const result = await database.run(
            `INSERT INTO categories (key, name_ru, name_uz, name_en, is_alcoholic, order_index)
             VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM categories))`,
            [key, name.ru, name.uz, name.en, isAlcoholic ? 1 : 0]
        );

        const categoryId = result.id;

        // Создание подкатегорий
        for (let i = 0; i < subcategories.length; i++) {
            const sub = subcategories[i];
            await database.run(
                `INSERT INTO subcategories (category_id, key, name_ru, name_uz, name_en, order_index)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [categoryId, sub.key, sub.name.ru, sub.name.uz, sub.name.en, i + 1]
            );
        }

        res.status(201).json({
            success: true,
            data: { id: categoryId },
            message: 'Категория успешно создана'
        });

    } catch (error) {
        console.error('Ошибка создания категории:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка создания категории'
        });
    }
});

// Обновить категорию (только для админов)
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { key, name, isAlcoholic, subcategories = [] } = req.body;

        // Проверка существования категории
        const existingCategory = await database.get(
            'SELECT id FROM categories WHERE id = ?',
            [id]
        );

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                error: 'Категория не найдена'
            });
        }

        // Обновление категории
        await database.run(
            `UPDATE categories
             SET key = ?, name_ru = ?, name_uz = ?, name_en = ?, is_alcoholic = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [key, name.ru, name.uz, name.en, isAlcoholic ? 1 : 0, id]
        );

        // Удаление старых подкатегорий
        await database.run('DELETE FROM subcategories WHERE category_id = ?', [id]);

        // Создание новых подкатегорий
        for (let i = 0; i < subcategories.length; i++) {
            const sub = subcategories[i];
            await database.run(
                `INSERT INTO subcategories (category_id, key, name_ru, name_uz, name_en, order_index)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, sub.key, sub.name.ru, sub.name.uz, sub.name.en, i + 1]
            );
        }

        res.json({
            success: true,
            message: 'Категория успешно обновлена'
        });

    } catch (error) {
        console.error('Ошибка обновления категории:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка обновления категории'
        });
    }
});

// Удалить категорию (только для админов)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Проверка существования категории
        const existingCategory = await database.get(
            'SELECT id FROM categories WHERE id = ?',
            [id]
        );

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                error: 'Категория не найдена'
            });
        }

        // Проверка наличия блюд в категории
        const dishesCount = await database.get(
            'SELECT COUNT(*) as count FROM dishes WHERE category_key = (SELECT key FROM categories WHERE id = ?)',
            [id]
        );

        if (dishesCount.count > 0) {
            return res.status(400).json({
                success: false,
                error: 'Нельзя удалить категорию, в которой есть блюда'
            });
        }

        // Удаление категории (подкатегории удалятся автоматически из-за CASCADE)
        await database.run('DELETE FROM categories WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Категория успешно удалена'
        });

    } catch (error) {
        console.error('Ошибка удаления категории:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка удаления категории'
        });
    }
});

module.exports = router;
