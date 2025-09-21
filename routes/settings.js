const express = require('express');
const database = require('../models/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Получить настройки
router.get('/', async (req, res) => {
    try {
        const settings = await database.all('SELECT key, value FROM settings');

        const settingsObj = {};
        settings.forEach(setting => {
            settingsObj[setting.key] = setting.value;
        });

        res.json({
            success: true,
            data: {
                serviceCharge: parseInt(settingsObj.service_charge) || 10,
                restaurantMode: settingsObj.restaurant_mode || 'public'
            }
        });

    } catch (error) {
        console.error('Ошибка получения настроек:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения настроек'
        });
    }
});

// Обновить настройки (только для админов)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { serviceCharge, restaurantMode } = req.body;

        if (serviceCharge !== undefined) {
            if (serviceCharge < 0 || serviceCharge > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Процент за обслуживание должен быть от 0 до 100'
                });
            }

            await database.run(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                [serviceCharge.toString(), 'service_charge']
            );
        }

        if (restaurantMode !== undefined) {
            if (!['public', 'restaurant'].includes(restaurantMode)) {
                return res.status(400).json({
                    success: false,
                    error: 'Режим ресторана должен быть "public" или "restaurant"'
                });
            }

            await database.run(
                'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                [restaurantMode, 'restaurant_mode']
            );
        }

        res.json({
            success: true,
            message: 'Настройки успешно обновлены'
        });

    } catch (error) {
        console.error('Ошибка обновления настроек:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка обновления настроек'
        });
    }
});

// Получить конкретную настройку
router.get('/:key', async (req, res) => {
    try {
        const { key } = req.params;

        const setting = await database.get(
            'SELECT value FROM settings WHERE key = ?',
            [key]
        );

        if (!setting) {
            return res.status(404).json({
                success: false,
                error: 'Настройка не найдена'
            });
        }

        res.json({
            success: true,
            data: { value: setting.value }
        });

    } catch (error) {
        console.error('Ошибка получения настройки:', error);
        res.status(500).json({
            success: false,
            error: 'Ошибка получения настройки'
        });
    }
});

module.exports = router;
