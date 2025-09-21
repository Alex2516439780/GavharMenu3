# 🚀 Инструкция по загрузке на GitHub

## Шаг 1: Создание репозитория на GitHub

1. Перейдите на [GitHub.com](https://github.com)
2. Нажмите кнопку **"New repository"** (зеленая кнопка)
3. Заполните форму:
   - **Repository name**: `gavhar-restaurant`
   - **Description**: `Modern restaurant menu system with admin panel`
   - **Visibility**: Public (или Private по желанию)
   - **НЕ** добавляйте README, .gitignore или лицензию (у нас уже есть)
4. Нажмите **"Create repository"**

## Шаг 2: Подключение локального репозитория к GitHub

Выполните следующие команды в терминале:

```bash
# Добавьте удаленный репозиторий (замените YOUR_USERNAME на ваш GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/gavhar-restaurant.git

# Переименуйте ветку в main (современный стандарт)
git branch -M main

# Загрузите код на GitHub
git push -u origin main
```

## Шаг 3: Настройка GitHub Actions (опционально)

После загрузки кода:

1. Перейдите в **Settings** → **Secrets and variables** → **Actions**
2. Добавьте следующие секреты:
   - `VPS_HOST` - IP адрес вашего VPS сервера
   - `VPS_USERNAME` - имя пользователя на VPS
   - `VPS_SSH_KEY` - приватный SSH ключ для доступа к VPS
   - `VPS_PORT` - порт SSH (обычно 22)

## Шаг 4: Проверка загрузки

После выполнения команд проверьте:

- [ ] Код загружен на GitHub
- [ ] README.md отображается корректно
- [ ] Все файлы присутствуют
- [ ] GitHub Actions настроены (если нужно)

## Шаг 5: Клонирование на VPS сервер

На вашем VPS сервере выполните:

```bash
# Клонирование репозитория
git clone https://github.com/YOUR_USERNAME/gavhar-restaurant.git
cd gavhar-restaurant

# Установка зависимостей
npm install --production

# Инициализация базы данных
npm run init-db

# Создание .env файла
cp env.example .env
nano .env  # Настройте переменные окружения

# Запуск с PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔧 Альтернативные способы загрузки

### Через GitHub CLI (если установлен)

```bash
gh repo create gavhar-restaurant --public --source=. --remote=origin --push
```

### Через веб-интерфейс GitHub

1. Создайте репозиторий на GitHub
2. Скачайте ZIP архив проекта
3. Загрузите файлы через веб-интерфейс

## 📋 Чек-лист перед загрузкой

- [ ] Все файлы добавлены в .gitignore
- [ ] README.md создан и актуален
- [ ] .env файл НЕ загружен (только env.example)
- [ ] База данных НЕ загружена (только структура)
- [ ] node_modules НЕ загружены
- [ ] Логи НЕ загружены
- [ ] Бэкапы НЕ загружены

## 🚨 Важные замечания

1. **НЕ загружайте** файл `.env` с реальными паролями
2. **НЕ загружайте** базу данных `database.sqlite`
3. **НЕ загружайте** папку `node_modules`
4. **НЕ загружайте** папку `backups`
5. **НЕ загружайте** папку `logs`

## 🎯 Следующие шаги

После загрузки на GitHub:

1. Настройте VPS сервер
2. Клонируйте репозиторий на сервер
3. Настройте переменные окружения
4. Запустите приложение
5. Настройте домен и SSL

**Удачной загрузки! 🚀**
