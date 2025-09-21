const database = require('../models/database');

async function initDatabase() {
    try {
        console.log('🚀 Инициализация базы данных...');

        // Инициализация базы данных
        await database.init();

        // Добавление тестовых категорий
        console.log('📁 Добавление тестовых категорий...');

        const categories = [
            {
                key: 'salads',
                name: { ru: 'Салаты', uz: 'Salatlar', en: 'Salads' },
                isAlcoholic: false,
                subcategories: [
                    { key: 'vegetable_salads', name: { ru: 'Овощные салаты', uz: 'Sabzavot salatlari', en: 'Vegetable salads' } },
                    { key: 'meat_salads', name: { ru: 'Мясные салаты', uz: 'Go\'sht salatlari', en: 'Meat salads' } }
                ]
            },
            {
                key: 'soups',
                name: { ru: 'Супы', uz: 'Sho\'rvalar', en: 'Soups' },
                isAlcoholic: false,
                subcategories: [
                    { key: 'hot_soups', name: { ru: 'Горячие супы', uz: 'Issiq sho\'rvalar', en: 'Hot soups' } },
                    { key: 'cold_soups', name: { ru: 'Холодные супы', uz: 'Sovuq sho\'rvalar', en: 'Cold soups' } }
                ]
            },
            {
                key: 'main_dishes',
                name: { ru: 'Основные блюда', uz: 'Asosiy taomlar', en: 'Main dishes' },
                isAlcoholic: false,
                subcategories: [
                    { key: 'steaks', name: { ru: 'Стейки', uz: 'Steyklar', en: 'Steaks' } },
                    { key: 'kebabs', name: { ru: 'Шашлыки', uz: 'Shashliklar', en: 'Kebabs' } },
                    { key: 'pasta', name: { ru: 'Паста', uz: 'Pasta', en: 'Pasta' } }
                ]
            },
            {
                key: 'desserts',
                name: { ru: 'Десерты', uz: 'Shirinliklar', en: 'Desserts' },
                isAlcoholic: false,
                subcategories: [
                    { key: 'cakes', name: { ru: 'Торты', uz: 'Tortlar', en: 'Cakes' } },
                    { key: 'ice_cream', name: { ru: 'Мороженое', uz: 'Muzqaymoq', en: 'Ice cream' } }
                ]
            },
            {
                key: 'beverages',
                name: { ru: 'Напитки', uz: 'Ichimliklar', en: 'Beverages' },
                isAlcoholic: false,
                subcategories: [
                    { key: 'soft_drinks', name: { ru: 'Безалкогольные', uz: 'Alkogolsiz', en: 'Soft drinks' } },
                    { key: 'hot_drinks', name: { ru: 'Горячие напитки', uz: 'Issiq ichimliklar', en: 'Hot drinks' } }
                ]
            },
            {
                key: 'alcohol',
                name: { ru: 'Алкоголь', uz: 'Alkogol', en: 'Alcohol' },
                isAlcoholic: true,
                subcategories: [
                    { key: 'wine', name: { ru: 'Вино', uz: 'Vino', en: 'Wine' } },
                    { key: 'beer', name: { ru: 'Пиво', uz: 'Pivo', en: 'Beer' } },
                    { key: 'spirits', name: { ru: 'Крепкие напитки', uz: 'Kuchli ichimliklar', en: 'Spirits' } }
                ]
            }
        ];

        for (const category of categories) {
            // Создание категории
            const categoryResult = await database.run(
                `INSERT OR IGNORE INTO categories (key, name_ru, name_uz, name_en, is_alcoholic, order_index)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [category.key, category.name.ru, category.name.uz, category.name.en, category.isAlcoholic ? 1 : 0, categories.indexOf(category) + 1]
            );

            const categoryId = categoryResult.id || await database.get(
                'SELECT id FROM categories WHERE key = ?',
                [category.key]
            ).then(row => row.id);

            // Создание подкатегорий
            for (let i = 0; i < category.subcategories.length; i++) {
                const sub = category.subcategories[i];
                await database.run(
                    `INSERT OR IGNORE INTO subcategories (category_id, key, name_ru, name_uz, name_en, order_index)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [categoryId, sub.key, sub.name.ru, sub.name.uz, sub.name.en, i + 1]
                );
            }
        }

        // Добавление тестовых блюд
        console.log('🍽️ Добавление тестовых блюд...');

        const dishes = [
            {
                name: { ru: 'Салат Цезарь', uz: 'Sezar salati', en: 'Caesar Salad' },
                category: 'salads',
                subcategory: 'vegetable_salads',
                price: 28000,
                order: 1,
                image: '/uploads/dishes/caesar-salad.jpg',
                images: ['/uploads/dishes/caesar-salad.jpg', '/uploads/dishes/caesar-salad-2.jpg'],
                composition: {
                    ru: 'Салат романо, куриная грудка, пармезан, сухарики, соус цезарь',
                    uz: 'Romaine salat, tovuq ko\'kragi, parmezan, quritilgan non, sezar sousi',
                    en: 'Romaine lettuce, chicken breast, parmesan, croutons, caesar dressing'
                },
                weight: '250г',
                cookingTime: '15 мин',
                inStock: true,
                isAlcoholic: false
            },
            {
                name: { ru: 'Борщ украинский', uz: 'Ukraincha borsh', en: 'Ukrainian Borscht' },
                category: 'soups',
                subcategory: 'hot_soups',
                price: 22000,
                order: 1,
                image: '/uploads/dishes/borscht.jpg',
                images: ['/uploads/dishes/borscht.jpg'],
                composition: {
                    ru: 'Свекла, говядина, капуста, морковь, лук, сметана',
                    uz: 'Qizil lavlagi, mol go\'shti, karam, sabzi, piyoz, qaymoq',
                    en: 'Beetroot, beef, cabbage, carrots, onions, sour cream'
                },
                weight: '350г',
                cookingTime: '45 мин',
                inStock: true,
                isAlcoholic: false
            },
            {
                name: { ru: 'Стейк Рибай', uz: 'Ribay steyk', en: 'Ribeye Steak' },
                category: 'main_dishes',
                subcategory: 'steaks',
                price: 85000,
                order: 1,
                image: '/uploads/dishes/ribeye-steak.jpg',
                images: ['/uploads/dishes/ribeye-steak.jpg', '/uploads/dishes/ribeye-steak-2.jpg'],
                composition: {
                    ru: 'Говядина рибай 300г, специи, зелень',
                    uz: 'Mol go\'shti ribay 300g, ziravorlar, ko\'katlar',
                    en: 'Ribeye beef 300g, spices, herbs'
                },
                weight: '300г',
                cookingTime: '20 мин',
                inStock: true,
                isAlcoholic: false
            },
            {
                name: { ru: 'Шашлык из баранины', uz: 'Qo\'zi shashlik', en: 'Lamb Kebab' },
                category: 'main_dishes',
                subcategory: 'kebabs',
                price: 45000,
                order: 1,
                image: '/uploads/dishes/lamb-kebab.jpg',
                images: ['/uploads/dishes/lamb-kebab.jpg'],
                composition: {
                    ru: 'Баранина, лук, специи, зелень',
                    uz: 'Qo\'zi go\'shti, piyoz, ziravorlar, ko\'katlar',
                    en: 'Lamb meat, onions, spices, herbs'
                },
                weight: '400г',
                cookingTime: '30 мин',
                inStock: true,
                isAlcoholic: false
            },
            {
                name: { ru: 'Тирамису', uz: 'Tiramisu', en: 'Tiramisu' },
                category: 'desserts',
                subcategory: 'cakes',
                price: 35000,
                order: 1,
                image: '/uploads/dishes/tiramisu.jpg',
                images: ['/uploads/dishes/tiramisu.jpg'],
                composition: {
                    ru: 'Маскарпоне, кофе, какао, савоярди, яйца, сахар',
                    uz: 'Mascarpone, kofe, kakao, savoyardi, tuxum, shakar',
                    en: 'Mascarpone, coffee, cocoa, savoiardi, eggs, sugar'
                },
                weight: '150г',
                cookingTime: '20 мин',
                inStock: true,
                isAlcoholic: false
            },
            {
                name: { ru: 'Красное вино Мерло', uz: 'Qizil vino Merlot', en: 'Red Wine Merlot' },
                category: 'alcohol',
                subcategory: 'wine',
                price: 120000,
                order: 1,
                image: '/uploads/dishes/merlot-wine.jpg',
                images: ['/uploads/dishes/merlot-wine.jpg'],
                composition: {
                    ru: 'Красное сухое вино, 750мл',
                    uz: 'Qizil quruq vino, 750ml',
                    en: 'Red dry wine, 750ml'
                },
                weight: '750мл',
                cookingTime: '0 мин',
                inStock: true,
                isAlcoholic: true
            },
            {
                name: { ru: 'Свежевыжатый апельсиновый сок', uz: 'Yangi siqilgan apelsin sharbati', en: 'Fresh Orange Juice' },
                category: 'beverages',
                subcategory: 'soft_drinks',
                price: 15000,
                order: 1,
                image: '/uploads/dishes/orange-juice.jpg',
                images: ['/uploads/dishes/orange-juice.jpg'],
                composition: {
                    ru: 'Апельсины, лед',
                    uz: 'Apelsinlar, muz',
                    en: 'Oranges, ice'
                },
                weight: '300мл',
                cookingTime: '5 мин',
                inStock: true,
                isAlcoholic: false
            }
        ];

        for (const dish of dishes) {
            await database.run(
                `INSERT OR IGNORE INTO dishes (
                    name_ru, name_uz, name_en, category_key, subcategory_key, price, order_index,
                    image, images, composition_ru, composition_uz, composition_en,
                    weight, cooking_time, in_stock, is_alcoholic
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    dish.name.ru, dish.name.uz, dish.name.en, dish.category, dish.subcategory, dish.price, dish.order,
                    dish.image, JSON.stringify(dish.images), dish.composition.ru, dish.composition.uz, dish.composition.en,
                    dish.weight, dish.cookingTime, dish.inStock ? 1 : 0, dish.isAlcoholic ? 1 : 0
                ]
            );
        }

        console.log('✅ База данных успешно инициализирована!');
        console.log('📊 Добавлено:');
        console.log(`   - ${categories.length} категорий`);
        console.log(`   - ${dishes.length} блюд`);
        console.log('🔑 Админ-доступ:');
        console.log('   - Логин: admin');
        console.log('   - Пароль: admin123');

    } catch (error) {
        console.error('❌ Ошибка инициализации базы данных:', error);
    } finally {
        await database.close();
    }
}

// Запуск инициализации
if (require.main === module) {
    initDatabase();
}

module.exports = initDatabase;
