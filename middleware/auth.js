const jwt = require('jsonwebtoken');
const config = require('../config');

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'Токен доступа не предоставлен'
        });
    }

    jwt.verify(token, config.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Недействительный токен'
            });
        }
        req.user = user;
        next();
    });
};

// Middleware для проверки админских прав
const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'Требуются права администратора'
        });
    }
    next();
};

module.exports = {
    authenticateToken,
    requireAdmin
};
