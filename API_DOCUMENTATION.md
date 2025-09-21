# GAVHAR Restaurant API Documentation

## Обзор

GAVHAR Restaurant API предоставляет RESTful интерфейс для управления меню ресторана, категориями блюд и настройками. API поддерживает многоязычность (русский, узбекский, английский) и включает систему фильтрации алкогольных напитков.

## Базовый URL

```
https://your-domain.com/api
```

## Аутентификация

Для административных операций требуется аутентификация через заголовок:

```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Категории

#### Получить все категории

```http
GET /api/categories
```

**Ответ:**

```json
{
  "data": [
    {
      "id": 1,
      "key": "salads",
      "name": {
        "ru": "Салаты",
        "uz": "Salatlar",
        "en": "Salads"
      },
      "isAlcoholic": false,
      "subcategories": [
        {
          "id": 11,
          "key": "vegetable_salads",
          "name": {
            "ru": "Овощные салаты",
            "uz": "Sabzavot salatlari",
            "en": "Vegetable salads"
          }
        }
      ]
    }
  ],
  "success": true
}
```

#### Создать категорию

```http
POST /api/categories
```

**Тело запроса:**

```json
{
  "key": "new_category",
  "name": {
    "ru": "Новая категория",
    "uz": "Yangi kategoriya",
    "en": "New category"
  },
  "isAlcoholic": false,
  "subcategories": []
}
```

#### Обновить категорию

```http
PUT /api/categories/{id}
```

#### Удалить категорию

```http
DELETE /api/categories/{id}
```

### Блюда

#### Получить все блюда

```http
GET /api/dishes
```

**Параметры запроса:**

- `category` (string) - фильтр по категории
- `subcategory` (string) - фильтр по подкатегории
- `inStock` (boolean) - только доступные блюда
- `language` (string) - язык для названий (ru, uz, en)

**Ответ:**

```json
{
  "data": [
    {
      "id": 1,
      "name": {
        "ru": "Салат Цезарь",
        "uz": "Sezar salati",
        "en": "Caesar Salad"
      },
      "category": "salads",
      "subcategory": "vegetable_salads",
      "price": 28000,
      "order": 1,
      "image": "https://example.com/image.jpg",
      "images": [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg"
      ],
      "composition": {
        "ru": "Салат романо, куриная грудка, пармезан",
        "uz": "Romaine salat, tovuq ko'kragi, parmezan",
        "en": "Romaine lettuce, chicken breast, parmesan"
      },
      "weight": "250г",
      "cookingTime": "15 мин",
      "inStock": true,
      "isAlcoholic": false
    }
  ],
  "success": true
}
```

#### Получить блюда по категории

```http
GET /api/dishes?category=salads
```

#### Получить блюда по подкатегории

```http
GET /api/dishes?category=salads&subcategory=vegetable_salads
```

#### Получить конкретное блюдо

```http
GET /api/dishes/{id}
```

#### Создать блюдо

```http
POST /api/dishes
```

**Тело запроса:**

```json
{
  "name": {
    "ru": "Новое блюдо",
    "uz": "Yangi taom",
    "en": "New dish"
  },
  "category": "salads",
  "subcategory": "vegetable_salads",
  "price": 25000,
  "order": 10,
  "image": "https://example.com/image.jpg",
  "images": ["https://example.com/image.jpg"],
  "composition": {
    "ru": "Состав блюда",
    "uz": "Taom tarkibi",
    "en": "Dish composition"
  },
  "weight": "200г",
  "cookingTime": "20 мин",
  "inStock": true,
  "isAlcoholic": false
}
```

#### Обновить блюдо

```http
PUT /api/dishes/{id}
```

#### Удалить блюдо

```http
DELETE /api/dishes/{id}
```

#### Изменить статус блюда

```http
PATCH /api/dishes/{id}/toggle-status
```

### Поиск

#### Поиск блюд

```http
GET /api/dishes/search?q=цезарь
```

### Настройки

#### Получить настройки

```http
GET /api/settings
```

**Ответ:**

```json
{
  "data": {
    "serviceCharge": 10,
    "restaurantMode": "restaurant"
  },
  "success": true
}
```

#### Обновить настройки

```http
PUT /api/settings
```

**Тело запроса:**

```json
{
  "serviceCharge": 15,
  "restaurantMode": "public"
}
```

## Особые возможности

### Фильтрация алкоголя

API автоматически фильтрует алкогольные напитки в зависимости от параметров URL:

- **Публичный доступ**: `https://site.com` - алкоголь скрыт
- **Ресторанный доступ**: `https://site.com?restaurant=true` - алкоголь показан

### Процент за обслуживание

Процент за обслуживание применяется только при ресторанном доступе:

- Публичный доступ: 0%
- Ресторанный доступ: настраиваемый процент (по умолчанию 10%)

### Многоязычность

Все текстовые поля поддерживают 3 языка:

- `ru` - русский
- `uz` - узбекский
- `en` - английский

### Сортировка

Блюда сортируются по полю `order` в порядке возрастания.

## Коды ошибок

- `200` - Успешно
- `201` - Создано
- `400` - Неверный запрос
- `401` - Не авторизован
- `403` - Доступ запрещен
- `404` - Не найдено
- `500` - Внутренняя ошибка сервера

## Примеры использования

### JavaScript Client

```javascript
// Инициализация API
const api = new GavharAPI();

// Получить все категории
const categories = await api.getCategories();

// Получить блюда по категории
const dishes = await api.getDishesByCategory("salads");

// Поиск блюд
const searchResults = await api.searchDishes("цезарь");

// Создать новое блюдо (требует авторизации)
const newDish = await api.createDish({
  name: { ru: "Новый салат", uz: "Yangi salat", en: "New salad" },
  category: "salads",
  price: 30000,
});
```

### Curl примеры

```bash
# Получить все категории
curl -X GET "https://your-domain.com/api/categories"

# Получить блюда категории "салаты"
curl -X GET "https://your-domain.com/api/dishes?category=salads"

# Создать новое блюдо
curl -X POST "https://your-domain.com/api/dishes" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "name": {"ru": "Новое блюдо"},
    "category": "salads",
    "price": 25000
  }'
```

## Ограничения

- Максимальный размер изображения: 15MB
- Максимальная длина названия: 100 символов
- Максимальная длина описания: 500 символов
- Максимальное количество изображений на блюдо: 10

## Поддержка

Для получения поддержки обращайтесь к администратору системы.
