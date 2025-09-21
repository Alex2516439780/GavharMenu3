const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const database = require('../models/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Вход в систему
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Имя пользователя и пароль обязательны'
            });
        }

        // Поиск пользователя в базе данных
        const user = await database.get(
            'SELECT * FROM admin_users WHERE username = ?',
            [username]
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Неверные учетные данные'
            });
        }

        // Проверка пароля
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Неверные учетные данные'
            });
        }

        // Создание JWT токена
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: 'admin'
            },
            config.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: 'admin'
                }
            }
        });

    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
});

// Проверка токена
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        data: {
            user: req.user
        }
    });
});

// Выход из системы (на клиенте просто удаляется токен)
router.post('/logout', (req, res) => {
    res.json({
        success: true,
        message: 'Успешный выход из системы'
    });
});

// Изменение пароля
router.put('/change-password', authenticateToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Текущий и новый пароль обязательны'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Новый пароль должен содержать минимум 6 символов'
            });
        }

        // Получение текущего пользователя
        const user = await database.get(
            'SELECT * FROM admin_users WHERE id = ?',
            [req.user.id]
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Пользователь не найден'
            });
        }

        // Проверка текущего пароля
        const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                error: 'Неверный текущий пароль'
            });
        }

        // Хеширование нового пароля
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Обновление пароля в базе данных
        await database.run(
            'UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedNewPassword, req.user.id]
        );

        res.json({
            success: true,
            message: 'Пароль успешно изменен'
        });

    } catch (error) {
        console.error('Ошибка изменения пароля:', error);
        res.status(500).json({
            success: false,
            error: 'Внутренняя ошибка сервера'
        });
    }
});

module.exports = router;
