// Global variables
let currentLanguage = 'ru';
let currentCategory = null;
let currentSubcategory = null;
let selectedCategory = null; // New: currently selected category for display
let cart = [];
let dishes = [];
let allDishes = []; // Store all dishes for global search
let categories = [];
let currentSlide = 0;
const cardsPerView = 4;

// Функции для обработки загрузки изображений (без inline JavaScript)
function handleImageLoad(img) {
    img.style.filter = 'brightness(1.05)';
    img.style.opacity = '1';
    img.classList.remove('loading');
}

function handleImageError(img) {
    img.src = '/ELEMENTS/image 2.png';
    img.style.filter = 'brightness(1.05)';
    img.style.opacity = '1';
    img.classList.remove('loading');
    console.warn('Failed to load image:', img.dataset.src);
}

// Silence verbose logs in production (keep errors/warnings)
(function(){
    try {
        const isDevHost = /localhost|127\.0\.0\.1/.test(location.hostname);
        const urlDebug = new URLSearchParams(location.search).has('debug');
        if (!isDevHost && !urlDebug) {
            ['log','info','debug'].forEach(k => { try { console[k] = function(){}; } catch(_){} });
        }
    } catch(_){}
})();

// Utils
function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Улучшенная ленивая загрузка изображений с приоритизацией и прогрессивной загрузкой
function hydrateLazyElement(target, isPriority = false) {
    if (!target) return;

    if (target.tagName === 'PICTURE') {
        const sources = target.querySelectorAll('source[data-srcset]');
        const img = target.querySelector('img[data-src]');

        // Загружаем источники по приоритету
        if (isPriority) {
            // Для приоритетных изображений загружаем сразу
            sources.forEach(src => {
                src.setAttribute('srcset', src.getAttribute('data-srcset'));
                src.removeAttribute('data-srcset');
            });
            if (img) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
        } else {
            // Для остальных - прогрессивная загрузка
            sources.forEach(src => {
                src.setAttribute('srcset', src.getAttribute('data-srcset'));
                src.removeAttribute('data-srcset');
            });
            if (img) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
        }
        target.classList.remove('lazy-picture');
    } else if (target.tagName === 'IMG' && target.dataset && target.dataset.src) {
        if (isPriority) {
            target.src = target.dataset.src;
            target.removeAttribute('data-src');
        } else {
            // Прогрессивная загрузка с небольшой задержкой
            target.src = target.dataset.src;
            target.removeAttribute('data-src');
        }
    }

    // НЕ удаляем класс loading здесь - он будет удален в onload
}

let __imageObserver = null;
function getImageObserver() {
    if (!('IntersectionObserver' in window)) return null;
    if (__imageObserver) return __imageObserver;

    __imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Для ленивых изображений просто загружаем их
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');

                    // Добавляем класс загрузки для плавного появления
                    img.classList.add('loading');

                    // Убираем класс загрузки после загрузки изображения
                    img.onload = function() {
                        this.classList.remove('loading');
                        this.style.opacity = '1';
                    };
                }

                observer.unobserve(entry.target);
            }
        });
    }, {
        rootMargin: '200px 0px', // Загружаем за 200px до появления в viewport
        threshold: 0.1
    });
    return __imageObserver;
}

function setupLazyImages(root = document) {
    // Находим только изображения с data-src для ленивой загрузки
    const lazyImages = root.querySelectorAll('img[data-src]');

    if (lazyImages.length === 0) {
        return; // Нет ленивых изображений для обработки
    }

    const observer = getImageObserver();
    if (observer) {
        // Наблюдаем только за ленивыми изображениями
        lazyImages.forEach(img => observer.observe(img));
    } else {
        // Fallback: загружаем все ленивые изображения сразу
        lazyImages.forEach(img => {
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
        });
    }
}

// API Base URL - адаптивная настройка для разных окружений
const API_BASE = (() => {
    // Если разработка на localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return '/api';
    }
    // Для продакшена - используем текущий домен
    return `${window.location.protocol}//${window.location.hostname}/api`;
})();

// Улучшенное кэширование изображений с учетом размера и качества
function getImageCacheBuster() {
    const fromUpdate = localStorage.getItem('gavhar_last_known_update') || localStorage.getItem('gavhar_data_updated');
    return fromUpdate || String(Date.now());
}

// Определение качества изображения на основе скорости соединения
function getOptimalImageQuality() {
    if ('connection' in navigator) {
        const conn = navigator.connection;
        if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
            return { quality: 60, format: 'webp' }; // Низкое качество для медленного интернета
        } else if (conn.effectiveType === '3g') {
            return { quality: 75, format: 'webp' }; // Среднее качество для 3G
        } else if (conn.effectiveType === '4g') {
            return { quality: 85, format: 'webp' }; // Высокое качество для 4G
        }
    }

    // Fallback на основе времени загрузки страницы
    const loadTime = performance.now();
    if (loadTime > 3000) {
        return { quality: 60, format: 'webp' }; // Медленная загрузка - низкое качество
    } else if (loadTime > 1500) {
        return { quality: 75, format: 'webp' }; // Средняя загрузка - среднее качество
    }

    return { quality: 85, format: 'webp' }; // По умолчанию - высокое качество
}

// Проверка поддержки современных форматов изображений
function getSupportedImageFormats() {
    const formats = {
        webp: false,
        avif: false,
        jpeg: true, // Всегда поддерживается
        png: true   // Всегда поддерживается
    };

    // Проверка WebP
    const webpCanvas = document.createElement('canvas');
    webpCanvas.width = 1;
    webpCanvas.height = 1;
    formats.webp = webpCanvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;

    // Проверка AVIF (более современный формат)
    if (typeof Image !== 'undefined') {
        const avifTest = new Image();
        avifTest.onload = () => formats.avif = true;
        avifTest.onerror = () => formats.avif = false;
        avifTest.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    }

    return formats;
}

function prewarmApiCache(urls) {
    try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller && Array.isArray(urls) && urls.length) {
            navigator.serviceWorker.controller.postMessage({ type: 'prewarm', urls: urls });
        }
    } catch(_){}
}

function prewarmQueue(urls, delayMs = 1200, maxItems = 5) {
    try {
        const queue = (urls || []).slice(0, maxItems);
        if (queue.length === 0) return;
        let i = 0;
        const schedule = window.requestIdleCallback || function(cb){ return setTimeout(cb, delayMs); };
        const step = () => {
            if (i >= queue.length) return;
            const url = queue[i++];
            try { fetch(url).catch(()=>{}); } catch(_){}
            prewarmApiCache([url]);
            schedule(step, { timeout: delayMs });
        };
        schedule(step, { timeout: delayMs });
    } catch(_){}
}

// Предварительная загрузка критических изображений
function preloadCriticalImages(dishes) {
    if (!Array.isArray(dishes) || dishes.length === 0) return;

    const imageQuality = getOptimalImageQuality();
    const supportedFormats = getSupportedImageFormats();
    const criticalImages = dishes.slice(0, 6); // Первые 6 изображений (приоритетные)

    criticalImages.forEach((dish, index) => {
        if (!dish.image) return;

        const isUnsplash = dish.image.includes('images.unsplash.com');
        if (isUnsplash) {
            const bestFormat = supportedFormats.avif ? 'avif' : (supportedFormats.webp ? 'webp' : 'auto');
            const quality = imageQuality.quality;
            const preloadUrl = `${dish.image}${dish.image.includes('?') ? '&' : '?'}w=400&h=250&fit=crop&fm=${bestFormat}&auto=format&q=${quality}`;

            // Создаем link элемент для preload
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = preloadUrl;
            link.fetchpriority = index < 3 ? 'high' : 'low'; // Первые 3 - высокий приоритет

            // Добавляем в head
            document.head.appendChild(link);

            // Удаляем после загрузки для экономии памяти
            setTimeout(() => {
                if (link.parentNode) {
                    link.parentNode.removeChild(link);
                }
            }, 15000); // Увеличиваем время до 15 секунд
        }
    });
}

// Функция для адаптивной загрузки изображений на основе скорости соединения
function adaptiveImageLoading() {
    const imageQuality = getOptimalImageQuality();

    // Если соединение медленное, уменьшаем количество одновременно загружаемых изображений
    if (imageQuality.quality <= 60) {
        // Для медленного соединения загружаем по одному изображению
        const observer = getImageObserver();
        if (observer) {
            observer.disconnect();
            // Создаем новый observer с меньшим rootMargin
            __imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setTimeout(() => {
                            const img = entry.target;
                            if (img.dataset.src) {
                                img.src = img.dataset.src;
                                img.removeAttribute('data-src');
                            }
                            observer.unobserve(entry.target);
                        }, 200); // Добавляем задержку для медленного соединения
                    }
                });
            }, {
                rootMargin: '50px 0px', // Меньший rootMargin для медленного соединения
                threshold: 0.1
            });
        }
    }
}

// Translations
const translations = {
    ru: {
        salads: 'САЛАТЫ',
        drinks: 'НАПИТКИ',
        desserts: 'ДЕСЕРТЫ',
        steak: 'СТЕЙК',
        shashlik: 'ШАШЛЫКИ',
        cart: 'Корзина',
        total: 'Итого:',
        checkout: 'Очистить',
        composition: 'Состав:',
        weight: 'Вес:',
        cooking_time: 'Время приготовления:',
        search_placeholder: 'Найти блюда',
        all: 'Все',
        cart_empty: 'Корзина пуста',
        order_total: 'Сумма заказа:',
        service_charge: 'Обслуживание',
        sum: 'сум'
    },
    uz: {
        salads: 'SALATLAR',
        drinks: 'ICHIMLIKLAR',
        desserts: 'TATLILAR',
        steak: 'STEAK',
        shashlik: 'SHASHLIKLAR',
        cart: 'Savat',
        total: 'Jami:',
        checkout: 'Tozalash',
        composition: 'Tarkibi:',
        weight: 'Og\'irligi:',
        cooking_time: 'Tayyorlash vaqti:',
        search_placeholder: 'Taom qidirish',
        all: 'Hammasi',
        cart_empty: 'Savat bo\'sh',
        order_total: 'Buyurtma summasi:',
        service_charge: 'Xizmat',
        sum: 'so\'m'
    },
    en: {
        salads: 'SALADS',
        drinks: 'DRINKS',
        desserts: 'DESSERTS',
        steak: 'STEAK',
        shashlik: 'SHASHLIK',
        cart: 'Cart',
        total: 'Total:',
        checkout: 'Clear',
        composition: 'Composition:',
        weight: 'Weight:',
        cooking_time: 'Cooking time:',
        search_placeholder: 'Find dishes',
        all: 'All',
        cart_empty: 'Cart is empty',
        order_total: 'Order total:',
        service_charge: 'Service',
        sum: 'sum'
    }
};

// Sample categories with subcategories
const sampleCategories = [
    {
        id: 1,
        key: 'drinks',
        name: { ru: 'Напитки', uz: 'Ichimliklar', en: 'Drinks' },
        isAlcoholic: false,
        subcategories: [
            { id: 11, key: 'hot_drinks', name: { ru: 'Горячие напитки', uz: 'Issiq ichimliklar', en: 'Hot drinks' } },
            { id: 12, key: 'cold_drinks', name: { ru: 'Холодные напитки', uz: 'Sovuq ichimliklar', en: 'Cold drinks' } },
            { id: 13, key: 'juices', name: { ru: 'Соки', uz: 'Sharbatlar', en: 'Juices' } }
        ]
    },
    {
        id: 2,
        key: 'salads',
        name: { ru: 'Салаты', uz: 'Salatlar', en: 'Salads' },
        isAlcoholic: false,
        subcategories: [
            { id: 21, key: 'vegetable_salads', name: { ru: 'Овощные салаты', uz: 'Sabzavot salatlari', en: 'Vegetable salads' } },
            { id: 22, key: 'meat_salads', name: { ru: 'Салаты с мясом', uz: 'Goshtli salatlar', en: 'Meat salads' } }
        ]
    },
    {
        id: 3,
        key: 'desserts',
        name: { ru: 'Десерты', uz: 'Shirinliklar', en: 'Desserts' },
        isAlcoholic: false,
        subcategories: [
            { id: 31, key: 'cakes', name: { ru: 'Торты', uz: 'Tortlar', en: 'Cakes' } },
            { id: 32, key: 'ice_cream', name: { ru: 'Мороженое', uz: 'Muzqaymoq', en: 'Ice cream' } }
        ]
    },
    {
        id: 4,
        key: 'steak',
        name: { ru: 'Стейк', uz: 'Steak', en: 'Steak' },
        isAlcoholic: false,
        subcategories: [
            { id: 41, key: 'beef_steak', name: { ru: 'Говяжий стейк', uz: 'Mol goshti steaki', en: 'Beef steak' } },
            { id: 42, key: 'chicken_steak', name: { ru: 'Куриный стейк', uz: 'Tovuq steaki', en: 'Chicken steak' } }
        ]
    },
    {
        id: 5,
        key: 'shashlik',
        name: { ru: 'Шашлыки', uz: 'Shashliklar', en: 'Shashlik' },
        isAlcoholic: false,
        subcategories: [
            { id: 51, key: 'lamb_shashlik', name: { ru: 'Шашлык из баранины', uz: 'Qoy goshti shashligi', en: 'Lamb shashlik' } },
            { id: 52, key: 'chicken_shashlik', name: { ru: 'Шашлык из курицы', uz: 'Tovuq shashligi', en: 'Chicken shashlik' } }
        ]
    },
    {
        id: 6,
        key: 'dishes',
        name: { ru: 'Блюда', uz: 'Taomlar', en: 'Dishes' },
        isAlcoholic: false,
        subcategories: [
            { id: 61, key: 'soups', name: { ru: 'Супы', uz: 'Sho\'rvalar', en: 'Soups' } },
            { id: 62, key: 'side_dishes', name: { ru: 'Гарниры', uz: 'Garnir', en: 'Side dishes' } },
            { id: 63, key: 'main_dishes', name: { ru: 'Основные блюда', uz: 'Asosiy taomlar', en: 'Main dishes' } }
        ]
    },
    {
        id: 7,
        key: 'alcohol',
        name: { ru: 'Алкоголь', uz: 'Alkogol', en: 'Alcohol' },
        isAlcoholic: true,
        subcategories: [
            { id: 71, key: 'wine', name: { ru: 'Вино', uz: 'Sharob', en: 'Wine' } },
            { id: 72, key: 'vodka', name: { ru: 'Водка', uz: 'Aroq', en: 'Vodka' } },
            { id: 73, key: 'beer', name: { ru: 'Пиво', uz: 'Pivo', en: 'Beer' } }
        ]
    }
];

// Sample data
const sampleDishes = [
    {
        id: 1,
        name: { ru: 'Салат Цезарь', uz: 'Sezar salati', en: 'Caesar Salad' },
        category: 'salads',
        subcategory: 'vegetable_salads',
        price: 28000,
        order: 1,
        image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Салат романо, куриная грудка, пармезан, сухарики, соус цезарь',
            uz: 'Romaine salat, tovuq ko\'kragi, parmezan, kruton, sezar sousi',
            en: 'Romaine lettuce, chicken breast, parmesan, croutons, caesar dressing'
        },
        weight: '250г',
        cookingTime: '15 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 2,
        name: { ru: 'Салат ташкент', uz: 'Toshkent salati', en: 'Tashkent Salad' },
        category: 'salads',
        subcategory: 'vegetable_salads',
        price: 28000,
        order: 2,
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Свежие овощи, зелень, оливковое масло',
            uz: 'Yangi sabzavotlar, ko\'katlar, zaytun moyi',
            en: 'Fresh vegetables, herbs, olive oil'
        },
        weight: '200г',
        cookingTime: '10 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 3,
        name: { ru: 'Салат с грибами', uz: 'Qo\'ziqorinli salat', en: 'Mushroom Salad' },
        category: 'salads',
        subcategory: 'vegetable_salads',
        price: 28000,
        order: 3,
        image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Шампиньоны, лук, майонез, зелень',
            uz: 'Champignon qo\'ziqorinlari, piyoz, mayonez, ko\'katlar',
            en: 'Mushrooms, onion, mayonnaise, herbs'
        },
        weight: '220г',
        cookingTime: '12 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 4,
        name: { ru: 'Салат аччик чичук', uz: 'Achchiq chichuk salat', en: 'Spicy Chichuk Salad' },
        category: 'salads',
        subcategory: 'vegetable_salads',
        price: 28000,
        order: 4,
        image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Помидоры, огурцы, лук, перец, специи',
            uz: 'Pomidor, bodring, piyoz, qalampir, ziravorlar',
            en: 'Tomatoes, cucumbers, onion, pepper, spices'
        },
        weight: '180г',
        cookingTime: '8 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 5,
        name: { ru: 'Салат с мясом', uz: 'Go\'shtli salat', en: 'Meat Salad' },
        category: 'salads',
        subcategory: 'meat_salads',
        price: 28000,
        order: 5,
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Говядина, овощи, зелень, соус',
            uz: 'Mol go\'shti, sabzavotlar, ko\'katlar, sous',
            en: 'Beef, vegetables, herbs, sauce'
        },
        weight: '300г',
        cookingTime: '20 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 6,
        name: { ru: 'Салат баклажан', uz: 'Baqlajon salati', en: 'Eggplant Salad' },
        category: 'salads',
        subcategory: 'vegetable_salads',
        price: 28000,
        order: 6,
        image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Баклажаны, помидоры, лук, чеснок',
            uz: 'Baqlajon, pomidor, piyoz, sarimsoq',
            en: 'Eggplant, tomatoes, onion, garlic'
        },
        weight: '200г',
        cookingTime: '25 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 7,
        name: { ru: 'Салат со свеклой', uz: 'Lobichali salat', en: 'Beetroot Salad' },
        category: 'salads',
        subcategory: 'vegetable_salads',
        price: 28000,
        order: 7,
        image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Свекла, морковь, чеснок, майонез',
            uz: 'Lobich, sabzi, sarimsoq, mayonez',
            en: 'Beetroot, carrots, garlic, mayonnaise'
        },
        weight: '190г',
        cookingTime: '30 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 8,
        name: { ru: 'Салат говурма', uz: 'Govurma salat', en: 'Govurma Salad' },
        category: 'salads',
        subcategory: 'meat_salads',
        price: 28000,
        order: 8,
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Жареное мясо, лук, специи',
            uz: 'Qovurilgan go\'sht, piyoz, ziravorlar',
            en: 'Fried meat, onion, spices'
        },
        weight: '250г',
        cookingTime: '35 мин',
        inStock: true,
        isAlcoholic: false
    },
    // Добавим алкогольные напитки
    {
        id: 101,
        name: { ru: 'Красное вино', uz: 'Qizil sharob', en: 'Red Wine' },
        category: 'alcohol',
        subcategory: 'wine',
        price: 45000,
        order: 1,
        image: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Натуральное красное вино',
            uz: 'Tabiiy qizil sharob',
            en: 'Natural red wine'
        },
        weight: '750мл',
        cookingTime: '0 мин',
        inStock: true,
        isAlcoholic: true
    },
    {
        id: 102,
        name: { ru: 'Пиво светлое', uz: 'Och pivo', en: 'Light Beer' },
        category: 'alcohol',
        subcategory: 'beer',
        price: 15000,
        order: 2,
        image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Светлое пиво премиум класса',
            uz: 'Premium sinf och pivo',
            en: 'Premium light beer'
        },
        weight: '500мл',
        cookingTime: '0 мин',
        inStock: true,
        isAlcoholic: true
    },
    // Новые блюда для тестирования навигации
    {
        id: 201,
        name: { ru: 'Кофе американо', uz: 'Americano kofe', en: 'Americano coffee' },
        category: 'drinks',
        subcategory: 'hot_drinks',
        price: 15000,
        order: 1,
        image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Эспрессо, горячая вода',
            uz: 'Espresso, issiq suv',
            en: 'Espresso, hot water'
        },
        weight: '200мл',
        cookingTime: '3 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 202,
        name: { ru: 'Свежевыжатый апельсиновый сок', uz: 'Taza apelsin sharbati', en: 'Fresh orange juice' },
        category: 'drinks',
        subcategory: 'juices',
        price: 12000,
        order: 2,
        image: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Свежие апельсины',
            uz: 'Taza apelsinlar',
            en: 'Fresh oranges'
        },
        weight: '250мл',
        cookingTime: '5 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 203,
        name: { ru: 'Салат с курицей и авокадо', uz: 'Tovuq va avokado salati', en: 'Chicken and avocado salad' },
        category: 'salads',
        subcategory: 'meat_salads',
        price: 32000,
        order: 2,
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Куриная грудка, авокадо, помидоры, руккола, оливковое масло',
            uz: 'Tovuq ko\'kragi, avokado, pomidor, rukola, zaytun moyi',
            en: 'Chicken breast, avocado, tomatoes, arugula, olive oil'
        },
        weight: '300г',
        cookingTime: '20 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 204,
        name: { ru: 'Тирамису', uz: 'Tiramisu', en: 'Tiramisu' },
        category: 'desserts',
        subcategory: 'cakes',
        price: 25000,
        order: 1,
        image: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Маскарпоне, савоярди, кофе, какао, яйца, сахар',
            uz: 'Mascarpone, savoyardi, kofe, kakao, tuxum, shakar',
            en: 'Mascarpone, savoiardi, coffee, cocoa, eggs, sugar'
        },
        weight: '150г',
        cookingTime: '0 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 205,
        name: { ru: 'Стейк из говядины', uz: 'Mol go\'shtidan steak', en: 'Beef steak' },
        category: 'steak',
        subcategory: 'beef_steak',
        price: 85000,
        order: 1,
        image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1529692236671-f1f6f9683df8?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Говяжья вырезка, соль, перец, розмарин, чеснок',
            uz: 'Mol go\'sht qismi, tuz, qalampir, rozmarin, sarimsoq',
            en: 'Beef tenderloin, salt, pepper, rosemary, garlic'
        },
        weight: '300г',
        cookingTime: '15 мин',
        inStock: true,
        isAlcoholic: false
    },
    {
        id: 206,
        name: { ru: 'Шашлык из баранины', uz: 'Qo\'zi go\'shtidan shashlik', en: 'Lamb shashlik' },
        category: 'shashlik',
        subcategory: 'lamb_shashlik',
        price: 65000,
        order: 1,
        image: 'https://images.unsplash.com/photo-1529692236671-f1f6f9683df8?w=400&h=300&fit=crop',
        images: [
            'https://images.unsplash.com/photo-1529692236671-f1f6f9683df8?w=400&h=300&fit=crop',
            'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=300&fit=crop'
        ],
        composition: {
            ru: 'Баранина, лук, специи, зелень',
            uz: 'Qo\'zi go\'shti, piyoz, ziravorlar, ko\'katlar',
            en: 'Lamb meat, onions, spices, herbs'
        },
        weight: '400г',
        cookingTime: '25 мин',
        inStock: true,
        isAlcoholic: false
    }
];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();

    // Force remove all focus outlines on any click
    document.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            setTimeout(() => {
                document.activeElement.blur();
            }, 0);
        }
    });

    // Force remove focus on any button interaction
    document.addEventListener('mousedown', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            e.target.blur();
        }
    });

    // Mobile touch events - prevent focus and outline
    document.addEventListener('touchstart', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            e.target.blur();
            e.target.style.outline = 'none';
            e.target.style.webkitTapHighlightColor = 'transparent';
        }
    });

    document.addEventListener('touchend', function(e) {
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            setTimeout(() => {
                e.target.blur();
                e.target.style.outline = 'none';
                e.target.style.webkitTapHighlightColor = 'transparent';
            }, 0);
        }
    });

    // Prevent focus on button press
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                e.preventDefault();
                e.target.click();
                e.target.blur();
            }
        }
    });
});

// Handle page visibility change (when returning from admin panel)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('Page became visible, checking for updates...');

        // Check if data was updated from admin panel
        const lastUpdate = localStorage.getItem('gavhar_data_updated');
        const lastKnownUpdate = localStorage.getItem('gavhar_last_known_update');

        if (lastUpdate && lastUpdate !== lastKnownUpdate) {
            console.log('Data was updated from admin panel, reloading...');
            localStorage.setItem('gavhar_last_known_update', lastUpdate);
            loadData().then(() => {
                console.log('Data reloaded after admin update');
            });
        } else if (typeof allDishes === 'undefined' || allDishes.length === 0) {
            console.log('Data missing, reloading...');
            loadData().then(() => {
                console.log('Data reloaded successfully');
            });
        } else {
            console.log('Data already loaded and up to date');
        }
    }
});

// Handle page focus (alternative approach)
window.addEventListener('focus', function() {
    console.log('Window focused, checking data...');

    // Check if data was updated from admin panel
    const lastUpdate = localStorage.getItem('gavhar_data_updated');
    const lastKnownUpdate = localStorage.getItem('gavhar_last_known_update');

    if (lastUpdate && lastUpdate !== lastKnownUpdate) {
        console.log('Data was updated from admin panel, reloading...');
        localStorage.setItem('gavhar_last_known_update', lastUpdate);
        loadData().then(() => {
            console.log('Data reloaded after admin update');
        });
    } else if (typeof allDishes === 'undefined' || allDishes.length === 0) {
        console.log('allDishes is empty, reloading data...');
        loadData().then(() => {
            console.log('Data reloaded on focus');
        });
    } else {
        console.log('Data is up to date');
    }
});

// Listen for data updates from admin panel
window.addEventListener('storage', function(e) {
    if (e.key === 'gavhar_data_updated') {
        console.log('Data updated from admin panel, reloading...');
        loadData().then(() => {
            console.log('Data reloaded after admin update');
        });
    }
});

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
}

async function initializeApp() {
    console.log('Initializing app...');
    console.log('Script version:', '1758039479860');

    // Force remove all focus outlines via CSS injection
    const style = document.createElement('style');
    style.textContent = `
        *, *::before, *::after { outline: none !important; }
        *:focus, *:active, *:focus-visible, *:focus-within {
            outline: none !important;
            outline-width: 0 !important;
            outline-style: none !important;
            outline-color: transparent !important;
            box-shadow: none !important;
        }
        button, button:focus, button:active, button:focus-visible, button:focus-within {
            outline: none !important;
            outline-width: 0 !important;
            outline-style: none !important;
            outline-color: transparent !important;
            box-shadow: none !important;
        }

        /* Mobile and tablet specific */
        @media (max-width: 1024px) {
            *, *::before, *::after {
                outline: none !important;
                -webkit-tap-highlight-color: transparent !important;
                -webkit-touch-callout: none !important;
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
            }

            *:focus, *:active, *:focus-visible, *:focus-within {
                outline: none !important;
                outline-width: 0 !important;
                outline-style: none !important;
                outline-color: transparent !important;
                box-shadow: none !important;
                -webkit-tap-highlight-color: transparent !important;
            }

            button, button:focus, button:active, button:focus-visible, button:focus-within {
                outline: none !important;
                outline-width: 0 !important;
                outline-style: none !important;
                outline-color: transparent !important;
                box-shadow: none !important;
                -webkit-tap-highlight-color: transparent !important;
                -webkit-touch-callout: none !important;
                -webkit-user-select: none !important;
                -moz-user-select: none !important;
                -ms-user-select: none !important;
                user-select: none !important;
            }
        }
    `;
    document.head.appendChild(style);

    // Clear any cached search state
    window.isGlobalSearch = false;
    window.searchQuery = null;
    window.originalDishes = null;

    // Force clear any cached data
    if (typeof allDishes !== 'undefined') {
        allDishes = [];
    }
    if (typeof dishes !== 'undefined') {
        dishes = [];
    }

    // Check if data was updated from admin panel
    const lastUpdate = localStorage.getItem('gavhar_data_updated');
    if (lastUpdate) {
        localStorage.setItem('gavhar_last_known_update', lastUpdate);
    }

    // Prefetch categories while HTML parses
    const categoriesPromise = fetch(`${API_BASE}/categories?restaurant=${isRestaurantMode()}`, { cache: 'no-cache' }).then(r=>r.ok?r.json():null).catch(()=>null);
    // Load data from API or fallback to localStorage
    await loadData();
    // Warm categories if prefetch succeeded
    try {
        const pref = await categoriesPromise;
        if (pref && Array.isArray(pref.data) && pref.data.length && (!categories || categories.length===0)) {
            categories = pref.data;
        }
    } catch(_){}

    // Clear search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.value = '';
    }

    // Set up event listeners
    setupEventListeners();

    // Initialize slider
    initSlider();

    // Update language
    updateLanguage();
}

async function loadData() {
    console.log('Loading data...');
    try {
        // Создаем контроллер для отмены запросов по таймауту
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд таймаут

        // Load from API with cache busting and timeout
        const [categoriesResponse, dishesResponse] = await Promise.all([
            fetch(`${API_BASE}/categories?restaurant=${isRestaurantMode()}`, {
                cache: 'no-cache',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }),
            fetch(`${API_BASE}/dishes?restaurant=${isRestaurantMode()}&light=1`, {
                cache: 'no-cache',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            })
        ]);

        // Очищаем таймаут если запросы успешны
        clearTimeout(timeoutId);

        if (categoriesResponse.ok) {
            const categoriesData = await categoriesResponse.json();
            categories = categoriesData.data || [];
        } else {
            categories = [...sampleCategories];
        }

        if (dishesResponse.ok) {
            const dishesData = await dishesResponse.json();
            dishes = (dishesData.data || []).map(d => ({
                ...d,
                // Ensure fields exist to avoid undefined when modal opens
                images: d.images || [],
                composition: d.composition || { ru: '', uz: '', en: '' },
                weight: d.weight || '',
                cookingTime: d.cookingTime || ''
            }));
            allDishes = [...dishes]; // Store all dishes for global search
            console.log('Loaded dishes from API:', dishes.length);
            console.log('All dishes stored:', allDishes.length);
        } else {
            dishes = [...sampleDishes];
            allDishes = [...sampleDishes]; // Store all dishes for global search
            console.log('Loaded sample dishes:', dishes.length);
            console.log('All dishes stored:', allDishes.length);
        }

        // Load cart from localStorage
        const savedCart = localStorage.getItem('gavhar_cart');
        if (savedCart) {
            cart = JSON.parse(savedCart);
        }

        // Render data
        renderCategories();
        updateCartDisplay();

        // Инициализируем адаптивную загрузку изображений
        adaptiveImageLoading();

        // Предзагружаем критические изображения
        preloadCriticalImages(dishes);

        // Prefetch dishes for first visible category (for fast switch)
        if (!currentCategory && categories.length > 0) {
            const allowAlcohol = isAlcoholicAllowed();
            const visibleCategories = categories.filter(cat => !cat.isAlcoholic || allowAlcohol);
            if (visibleCategories.length > 0) {
                const first = visibleCategories[0];
                // try preloading dishes of first category in background
                const catUrl = `${API_BASE}/categories?restaurant=${isRestaurantMode()}`;
                const firstDishesUrl = `${API_BASE}/dishes?restaurant=${isRestaurantMode()}&light=1&category=${encodeURIComponent(first.key)}`;
                try {
                    // Network prefetch
                    fetch(firstDishesUrl, { cache: 'no-cache' }).catch(()=>{});
                    // SW prewarm
                    prewarmApiCache([catUrl, firstDishesUrl]);
                    // Progressive warm-up for next categories (up to 5)
                    const nextUrls = visibleCategories.slice(1, 6).map(c => `${API_BASE}/dishes?restaurant=${isRestaurantMode()}&light=1&category=${encodeURIComponent(c.key)}`);
                    prewarmQueue(nextUrls, 1200, 5);
                } catch(_){}
                selectMainCategory(first);
            }
        } else if (currentCategory) {
            renderDishes();
        }

        // Update quantity displays for all dishes after loading cart
        dishes.forEach(dish => {
            updateQuantityDisplay(dish.id);
        });

    } catch (error) {
        // Fallback to localStorage
        loadDataFromLocalStorage();
    }
}

function loadDataFromLocalStorage() {
    console.log('Loading data from localStorage...');
    const savedDishes = localStorage.getItem('gavhar_dishes');
    const savedCart = localStorage.getItem('gavhar_cart');
    const savedCategories = localStorage.getItem('gavhar_categories');

    if (savedDishes) {
        dishes = JSON.parse(savedDishes);
        allDishes = [...dishes]; // Store all dishes for global search
        console.log('Loaded dishes from localStorage:', dishes.length);
        console.log('All dishes stored:', allDishes.length);
    } else {
        dishes = [...sampleDishes];
        allDishes = [...sampleDishes]; // Store all dishes for global search
        console.log('Loaded sample dishes:', dishes.length);
        console.log('All dishes stored:', allDishes.length);
        saveData();
    }

    if (savedCart) {
        cart = JSON.parse(savedCart);
    }

    if (savedCategories) {
        categories = JSON.parse(savedCategories);
    } else {
        categories = [...sampleCategories];
        localStorage.setItem('gavhar_categories', JSON.stringify(categories));
    }

    renderCategories();
    updateCartDisplay();

    // Initialize with first category if none selected
    if (!currentCategory && categories.length > 0) {
        const allowAlcohol = isAlcoholicAllowed();
        const visibleCategories = categories.filter(cat => !cat.isAlcoholic || allowAlcohol);
        if (visibleCategories.length > 0) {
            selectMainCategory(visibleCategories[0]);
        }
    } else if (currentCategory) {
        renderDishes();
    }

    // Update quantity displays for all dishes after loading cart
    dishes.forEach(dish => {
        updateQuantityDisplay(dish.id);
    });
}

function isRestaurantMode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('restaurant') || urlParams.has('admin') || urlParams.has('service');
}

async function searchDishes(query) {
    try {
        const response = await fetch(`${API_BASE}/dishes/search?q=${encodeURIComponent(query)}&restaurant=${isRestaurantMode()}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.success && Array.isArray(data.data)) {
                let searchResults = data.data;

                // Если вдруг пришло пусто — локальный фоллбек, учитывающий кириллицу
                if (searchResults.length === 0) {
                    const qLower = String(query).toLocaleLowerCase('ru-RU');
                    searchResults = allDishes.filter(d => {
                        const name = (d.name?.[currentLanguage] || '').toLocaleLowerCase('ru-RU');
                        const comp = (d.composition?.[currentLanguage] || '').toLocaleLowerCase('ru-RU');
                        return name.includes(qLower) || comp.includes(qLower);
                    });
                }

                // Save original dishes only once
                if (!window.originalDishes) {
                    window.originalDishes = [...dishes];
                }

                // Set global search mode
                window.isGlobalSearch = true;
                window.searchQuery = query;
                dishes = searchResults;
                renderDishes();
            } else {
                // Backend вернул неуспешный ответ — локальный фоллбек
                if (!window.originalDishes) {
                    window.originalDishes = [...dishes];
                }
                performGlobalSearch(query.toLocaleLowerCase('ru-RU'));
            }
        } else {
            // Non-OK HTTP — локальный фоллбек
            if (!window.originalDishes) {
                window.originalDishes = [...dishes];
            }
            performGlobalSearch(query.toLocaleLowerCase('ru-RU'));
        }
    } catch (error) {
        console.error('Search error:', error);
        // Fallback to local search
        if (!window.originalDishes) {
            window.originalDishes = [...dishes];
        }
        performGlobalSearch(query.toLocaleLowerCase('ru-RU'));
    }
}

function saveData() {
    localStorage.setItem('gavhar_dishes', JSON.stringify(dishes));
    localStorage.setItem('gavhar_cart', JSON.stringify(cart));
}

function setupEventListeners() {
    // Language switcher
    document.getElementById('languageSelect').addEventListener('click', function() {
        // Simple language toggle for now
        const languages = ['RU', 'UZ', 'EN'];
        const currentIndex = languages.indexOf(currentLanguage.toUpperCase());
        const nextIndex = (currentIndex + 1) % languages.length;
        currentLanguage = languages[nextIndex].toLowerCase();
        this.textContent = languages[nextIndex] + ' ∨';
        updateLanguage();

        // Re-render language-dependent UI
        renderCategories();

        // Update side title and subcategories if category selected
        const activeCategory = selectedCategory || categories.find(c => c.key === currentCategory);
        if (activeCategory) {
            updateSideTitle(activeCategory.name[currentLanguage]);
            if (activeCategory.subcategories && activeCategory.subcategories.length > 0) {
                renderSubcategories(activeCategory.key);
                showSubcategoriesContainer();
            }
        }

        renderDishes();
        updateCartDisplay();
    });

    // Category buttons will be handled dynamically in renderCategories()

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        const debouncedSearch = debounce(async (value) => {
            if (value.length > 2) {
                // Ensure data is loaded before searching
                if (typeof allDishes === 'undefined' || allDishes.length === 0) {
                    console.log('Data not loaded, loading before search...');
                    await loadData();
                }
                await searchDishes(value);
            }
        }, 300);

        searchInput.addEventListener('input', function(e) {
            const query = e.target.value;
            const clearBtn = document.getElementById('clearSearch');

            console.log('Search input changed:', query, 'Clear button found:', !!clearBtn);

            // Show/hide clear button
            if (clearBtn) {
                if (query.length > 0) {
                    clearBtn.style.display = 'flex';
                    console.log('Showing clear button');
                } else {
                    clearBtn.style.display = 'none';
                    console.log('Hiding clear button');
                }
            }

            if (query.length === 0) {
                // Reset global search mode
                window.isGlobalSearch = false;
                window.searchQuery = null;

                if (window.originalDishes) {
                    dishes = [...window.originalDishes];
                    window.originalDishes = null;
                } else {
                    // If no original dishes saved, restore from allDishes
                    dishes = [...allDishes];
                }
                renderDishes();
                return;
            }
            if (query.length <= 2) {
                return; // wait for enough characters
            }
            debouncedSearch(query);
        });
    }

    // Clear search button
    const clearSearchBtn = document.getElementById('clearSearch');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            console.log('Clear button clicked');
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = '';
                clearSearchBtn.style.display = 'none';

                // Reset global search mode
                window.isGlobalSearch = false;
                window.searchQuery = null;

                if (window.originalDishes) {
                    dishes = [...window.originalDishes];
                    window.originalDishes = null;
                } else {
                    // If no original dishes saved, restore from allDishes
                    dishes = [...allDishes];
                }
                renderDishes();
            }
        });
    } else {
        console.log('Clear search button not found');
    }


    // Cart button
    document.getElementById('cartBtn').addEventListener('click', function() {
        toggleCartModal();
    });

    // Close cart modal
    document.getElementById('closeCart').addEventListener('click', function() {
        closeCartModal();
    });

    // Close dish modal
    document.getElementById('closeDishModal').addEventListener('click', function() {
        closeDishModal();
    });

    // Clear cart button (previously checkout button)
    const checkoutBtn = document.querySelector('.checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            clearCart();
        });
    }

    // Close modals when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('cart-modal')) {
            closeCartModal();
        }
        if (e.target.classList.contains('dish-modal')) {
            closeDishModal();
        }
    });

    // Event delegation for dish card quantity buttons
    const dishesGrid = document.getElementById('dishesGrid');
    if (dishesGrid) {
        dishesGrid.addEventListener('click', function(e) {
            const btn = e.target.closest('.qty-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                const dishId = parseInt(btn.getAttribute('data-dish-id'), 10);
                if (!isNaN(dishId)) {
                    const delta = btn.classList.contains('minus-btn') ? -1 : 1;
                    changeQuantity(dishId, delta);
                    // Remove focus after click to prevent outline
                    btn.blur();
                }
            }
        });
    }

    // Event delegation for cart items +/-
    const cartItemsEl = document.getElementById('cartItems');
    if (cartItemsEl) {
        cartItemsEl.addEventListener('click', function(e) {
            const btn = e.target.closest('.cart-qty-btn');
            if (btn) {
                e.preventDefault();
                e.stopPropagation();
                const dishId = parseInt(btn.getAttribute('data-dish-id'), 10);
                if (!isNaN(dishId)) {
                    const delta = btn.classList.contains('minus-btn') ? -1 : 1;
                    changeQuantity(dishId, delta);
                    renderCartItems();
                    // Remove focus after click to prevent outline
                    btn.blur();
                }
            }
        });
    }

    // Handle logo image errors (moved from duplicate init)
    const logoImg = document.querySelector('.logo img');
    if (logoImg) {
        logoImg.onerror = function() {
            console.warn('Logo image failed to load:', this.src);
            this.style.display = 'none';
        };
    }
}

// Enable horizontal scrolling with mouse wheel on desktop for a given container
function enableHorizontalWheelScroll(container) {
    try {
        if (!container || container.dataset && container.dataset.wheelScrollAttached === '1') return;
        const isFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
        if (!isFinePointer) return; // десктоп/мышь

        const onWheel = function(e) {
            const dx = Math.abs(e.deltaX);
            const dy = Math.abs(e.deltaY);
            if (dy > dx) {
                e.preventDefault();
                const speed = e.shiftKey ? 2 : 1; // ускорение при Shift
                container.scrollLeft += e.deltaY * speed;
            }
        };
        container.addEventListener('wheel', onWheel, { passive: false });
        container.dataset.wheelScrollAttached = '1';
    } catch(_) {}
}

// Clear cart function
function clearCart() {
    if (cart.length === 0) return;

    if (confirm('Вы уверены, что хотите очистить корзину?')) {
        cart = [];
        saveData();
        updateCartDisplay();
        renderCartItems();

        // Update all quantity displays on cards
        document.querySelectorAll('[id^="quantity-"]').forEach(element => {
            element.textContent = '0';
        });
    }
}

function updateLanguage() {
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
        const key = element.dataset.translate;
        if (translations[currentLanguage] && translations[currentLanguage][key]) {
            element.textContent = translations[currentLanguage][key];
        }
    });

    // Update search placeholder
    document.getElementById('searchInput').placeholder = translations[currentLanguage].search_placeholder;

    // Update cart display with new language
    renderCartItems();
}

function switchCategory(category) {
    // Reset global search mode when switching categories
    window.isGlobalSearch = false;
    window.searchQuery = null;

    currentCategory = category;
    currentSubcategory = null; // Reset subcategory when switching main category

    // Update active category button
    document.querySelectorAll('.tabs button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');

    // Update category label
    const categoryObj = categories.find(cat => cat.key === category);
    const categoryLabel = document.getElementById('sideTitle');
    categoryLabel.textContent = categoryObj ? categoryObj.name[currentLanguage] : category.toUpperCase();

    // Show subcategories panel if category has subcategories
    const subcategoriesPanel = document.getElementById('subcategoriesPanel');
    if (categoryObj && categoryObj.subcategories && categoryObj.subcategories.length > 0) {
        renderSubcategories(category);
        subcategoriesPanel.classList.add('active');
    } else {
        subcategoriesPanel.classList.remove('active');
    }

    // Render dishes for this category
    renderDishes();
}

function renderDishes() {
    const dishesGrid = document.getElementById('dishesGrid');

    let filteredDishes;

    // Check if we're in global search mode
    if (window.isGlobalSearch) {
        // For global search, show all dishes from search results (dishes already contains search results)
        filteredDishes = dishes.filter(dish =>
            dish.inStock &&
            (!dish.isAlcoholic || isAlcoholicAllowed())
        );
    } else {
        // If no category is selected, don't render anything
        if (!currentCategory) {
            return;
        }

        filteredDishes = dishes.filter(dish =>
            dish.category === currentCategory &&
            dish.inStock &&
            (!dish.isAlcoholic || isAlcoholicAllowed())
        );

        // Filter by subcategory if one is selected
        if (currentSubcategory) {
            filteredDishes = filteredDishes.filter(dish => dish.subcategory === currentSubcategory);
        }
    }

    // Sort dishes by order
    filteredDishes.sort((a, b) => (a.order || 0) - (b.order || 0));

    dishesGrid.innerHTML = '';

    // If no dishes found, show message
    if (filteredDishes.length === 0) {
        const message = window.isGlobalSearch
            ? `По запросу "${window.searchQuery || ''}" ничего не найдено`
            : 'В этой категории нет доступных блюд';
        dishesGrid.innerHTML = `<div style="text-align: center; color: #f4e4bc; padding: 40px;">${message}</div>`;
        return;
    }

    // Single responsive grid
    const row = document.createElement('div');
    row.className = 'cards-row';
    dishesGrid.appendChild(row);

    // Batched rendering to avoid long tasks
    const batchSize = 24;
    let startIndex = 0;

    const schedule = window.requestIdleCallback || function(cb){ return setTimeout(cb, 0); };

    function renderBatch() {
        const frag = document.createDocumentFragment();
        const end = Math.min(startIndex + batchSize, filteredDishes.length);
        for (let i = startIndex; i < end; i++) {
            const dish = filteredDishes[i];
            // Первые 6 карточек загружаются с высоким приоритетом, остальные - лениво
            const isPriority = i < 6;
            const dishCard = createDishCard(dish, isPriority);
            frag.appendChild(dishCard);
        }
        row.appendChild(frag);
        setupLazyImages(row);

        // Update quantities for newly appended cards
        if (Array.isArray(cart) && cart.length > 0) {
            for (let i = startIndex; i < end; i++) {
                updateQuantityDisplay(filteredDishes[i].id);
            }
        }

        startIndex = end;
        if (startIndex < filteredDishes.length) {
            schedule(renderBatch);
        }
    }

    renderBatch();
}

function createDishCard(dish, isPriority = false) {
    const card = document.createElement('div');
    card.className = 'card';

    const alcoholicOverlay = dish.isAlcoholic ? '<div class="alcoholic-overlay">18+</div>' : '';

    // Use fallback image if dish.image is null or empty
    const primaryImage = (dish.image && String(dish.image).trim() !== '') ? dish.image : (Array.isArray(dish.images) && dish.images[0] ? dish.images[0] : null);
    const imageUrl = primaryImage || '/ELEMENTS/image 2.png';
    const isUnsplash = typeof imageUrl === 'string' && imageUrl.includes('images.unsplash.com');
    const isLocal = typeof imageUrl === 'string' && !/^https?:\/\//i.test(imageUrl);
    const cacheBust = getImageCacheBuster();

    // Получаем оптимальные настройки для текущего соединения
    const imageQuality = getOptimalImageQuality();
    const supportedFormats = getSupportedImageFormats();

    // Создаем адаптивные размеры для разных устройств с учетом качества соединения
    const createResponsiveImageUrls = (baseUrl) => {
        if (isUnsplash) {
            const bestFormat = supportedFormats.avif ? 'avif' : (supportedFormats.webp ? 'webp' : 'auto');
            const quality = imageQuality.quality;

            return {
                // Очень маленький placeholder для мгновенной загрузки
                placeholder: `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}w=20&h=12&fit=crop&fm=webp&blur=10&q=20&_v=${cacheBust}`,
                // Размеры для разных устройств
                small: `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}w=300&h=200&fit=crop&fm=${bestFormat}&auto=format&q=${Math.max(quality-10, 50)}&_v=${cacheBust}`,
                medium: `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}w=400&h=250&fit=crop&fm=${bestFormat}&auto=format&q=${quality}&_v=${cacheBust}`,
                large: `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}w=600&h=400&fit=crop&fm=${bestFormat}&auto=format&q=${Math.min(quality+5, 90)}&_v=${cacheBust}`,
                // Fallback форматы
                webp: `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}w=400&h=250&fit=crop&fm=webp&auto=format&q=${quality}&_v=${cacheBust}`,
                jpeg: `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}w=400&h=250&fit=crop&fm=jpg&auto=format&q=${quality}&_v=${cacheBust}`,
                original: `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}auto=format&q=${Math.min(quality+10, 95)}&_v=${cacheBust}`
            };
        }
        return {
            placeholder: baseUrl,
            small: baseUrl,
            medium: baseUrl,
            large: baseUrl,
            webp: baseUrl,
            jpeg: baseUrl,
            original: baseUrl
        };
    };

    const responsiveUrls = createResponsiveImageUrls(imageUrl);

    let normalizedLocal = '';
    if (isLocal) {
        normalizedLocal = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
        const lastSlash = normalizedLocal.lastIndexOf('/');
        const dir = normalizedLocal.substring(0, lastSlash);
        const file = normalizedLocal.substring(lastSlash + 1);
        const dot = file.lastIndexOf('.');
        const nameOnly = dot > -1 ? file.substring(0, dot) : file;
        // Для локальных изображений пытаемся «повысить» превью до 800px,
        // если ссылка указывает на -100/-200/-400.(webp|avif). Иначе оставляем как есть.
        const baseNoQuery = normalizedLocal.split('?')[0];
        const upgraded = baseNoQuery.replace(/-(100|200|400)\.(webp|avif)$/i, '-800.webp');
        normalizedLocal = upgraded;
    }

    // Создаем placeholder с низким качеством для быстрой загрузки
    const placeholderUrl = isUnsplash
        ? responsiveUrls.placeholder
        : '/ELEMENTS/image 2.png';

    // Гибридная оптимизация: приоритетные изображения загружаются сразу, остальные - лениво
    const loadingStrategy = isPriority ? 'eager' : 'lazy';
    const fetchPriority = isPriority ? 'high' : 'auto';

    // Для ленивых изображений используем data-src вместо src
    const imageSrc = isPriority ? responsiveUrls.medium : '';
    const dataSrc = isPriority ? '' : responsiveUrls.medium;

    card.innerHTML = `
         <div class="card-image-container">
            ${isUnsplash ? `
            <picture>
                ${supportedFormats.avif ? `<source srcset="${responsiveUrls.small.replace('webp', 'avif')} 300w, ${responsiveUrls.medium.replace('webp', 'avif')} 400w, ${responsiveUrls.large.replace('webp', 'avif')} 600w" type="image/avif" sizes="(max-width: 480px) 300px, (max-width: 768px) 400px, (max-width: 1200px) 300px, 400px">` : ''}
                ${supportedFormats.webp ? `<source srcset="${responsiveUrls.small} 300w, ${responsiveUrls.medium} 400w, ${responsiveUrls.large} 600w" type="image/webp" sizes="(max-width: 480px) 300px, (max-width: 768px) 400px, (max-width: 1200px) 300px, 400px">` : ''}
                <source srcset="${responsiveUrls.small.replace(supportedFormats.avif ? 'avif' : 'webp', 'jpg')} 300w, ${responsiveUrls.jpeg} 400w, ${responsiveUrls.large.replace(supportedFormats.avif ? 'avif' : 'webp', 'jpg')} 600w" type="image/jpeg" sizes="(max-width: 480px) 300px, (max-width: 768px) 400px, (max-width: 1200px) 300px, 400px">
                <img
                    ${isPriority ? `src="${responsiveUrls.medium}"` : `data-src="${responsiveUrls.medium}"`}
                    alt="${dish.name[currentLanguage]}"
                    loading="${loadingStrategy}"
                    decoding="async"
                    fetchpriority="${fetchPriority}"
                    width="400"
                    height="250"
                    style="transition: all 0.3s ease; filter: brightness(1.05); opacity: 1;"
                >
            </picture>` : isLocal ? `
            <img
                ${isPriority ? `src="${(normalizedLocal || imageUrl) + ((normalizedLocal || imageUrl).includes('?') ? '&' : '?') + 'v=' + cacheBust}"` : `data-src="${(normalizedLocal || imageUrl) + ((normalizedLocal || imageUrl).includes('?') ? '&' : '?') + 'v=' + cacheBust}"`}
                alt="${dish.name[currentLanguage]}"
                loading="${loadingStrategy}"
                decoding="async"
                fetchpriority="${fetchPriority}"
                width="400"
                height="250"
                style="image-rendering:auto; transition: opacity 0.3s; filter: brightness(1.05); opacity: 1;"
            >` : `
            <img
                ${isPriority ? `src="${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${cacheBust}"` : `data-src="${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${cacheBust}"`}
                alt="${dish.name[currentLanguage]}"
                loading="${loadingStrategy}"
                decoding="async"
                fetchpriority="${fetchPriority}"
                width="400"
                height="250"
                style="transition: opacity 0.3s; filter: brightness(1.05); opacity: 1;"
            >`
            }
            ${alcoholicOverlay}
         </div>
         <div class="card-body">
            <p>${dish.name[currentLanguage]}</p>
            <div class="price">${dish.price.toLocaleString()} сум</div>
            <div class="qty">
                <button class="qty-btn minus-btn" data-dish-id="${dish.id}">-</button>
                <span id="quantity-${dish.id}">0</span>
                <button class="qty-btn plus-btn" data-dish-id="${dish.id}">+</button>
            </div>
         </div>
     `;

    // Open modal ONLY when clicking on the image area
    const imageArea = card.querySelector('.card-image-container');
    if (imageArea) {
        imageArea.addEventListener('click', function(e) {
            e.stopPropagation();
            openDishModal(dish);
        });
    }

    // Обработчики событий больше не нужны - изображения загружаются сразу

    return card;
}

function changeQuantity(dishId, change) {
    const dish = dishes.find(d => d.id === dishId);
    if (!dish) return;

    const cartItem = cart.find(item => item.dishId === dishId);

    if (cartItem) {
        cartItem.quantity += change;
        if (cartItem.quantity <= 0) {
            cart = cart.filter(item => item.dishId !== dishId);
        }
    } else if (change > 0) {
        cart.push({
            dishId: dishId,
            quantity: 1,
            dish: dish
        });
    }

    saveData();
    updateCartDisplay();
    updateQuantityDisplay(dishId);
}

function updateQuantityDisplay(dishId) {
    const cartItem = cart.find(item => item.dishId === dishId);
    const quantityElement = document.getElementById(`quantity-${dishId}`);
    if (quantityElement) {
        quantityElement.textContent = cartItem ? cartItem.quantity : 0;
    }
}

function updateCartDisplay() {
    const cartCount = document.getElementById('cartCount');
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;

    // Обновлять только видимые счётчики (микрооптимизация)
    const qtyNodes = document.querySelectorAll('[id^="quantity-"]');
    qtyNodes.forEach(node => {
        const idStr = node.id.replace('quantity-', '');
        const dishId = parseInt(idStr, 10);
        if (!isNaN(dishId)) {
            updateQuantityDisplay(dishId);
        }
    });
}

function toggleCartModal() {
    const cartModal = document.getElementById('cartModal');
    cartModal.classList.toggle('active');

    if (cartModal.classList.contains('active')) {
        renderCartItems();
    }
}

function closeCartModal() {
    document.getElementById('cartModal').classList.remove('active');
}

function renderCartItems() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');

    if (cart.length === 0) {
        cartItems.innerHTML = `<p style="text-align: center; color: #f4e4bc;">${translations[currentLanguage].cart_empty}</p>`;
        cartTotal.textContent = `0 ${translations[currentLanguage].sum}`;

        // Remove any existing breakdown when cart is empty
        const cartFooter = document.querySelector('.cart-footer');
        const existingBreakdown = cartFooter.querySelector('.cart-breakdown');
        if (existingBreakdown) {
            existingBreakdown.remove();
        }
        return;
    }

    cartItems.innerHTML = '';
    let subtotal = 0;

    cart.forEach(item => {
        const cartItemElement = document.createElement('div');
        cartItemElement.className = 'cart-item';

        const itemTotal = item.dish.price * item.quantity;
        subtotal += itemTotal;

        cartItemElement.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.dish.name[currentLanguage]}</div>
                <div class="cart-item-price">${item.dish.price.toLocaleString()} ${translations[currentLanguage].sum} × ${item.quantity}</div>
            </div>
            <div class="cart-item-quantity">
                <button class="cart-qty-btn minus-btn" data-dish-id="${item.dishId}">-</button>
                <span>${item.quantity}</span>
                <button class="cart-qty-btn plus-btn" data-dish-id="${item.dishId}">+</button>
            </div>
        `;

        cartItems.appendChild(cartItemElement);
    });

    // Calculate service charge
    const serviceChargePercent = getServiceChargePercent();
    const serviceCharge = Math.round(subtotal * serviceChargePercent / 100);
    const total = subtotal + serviceCharge;

    // Update total display with breakdown
    const cartFooter = document.querySelector('.cart-footer');
    const existingBreakdown = cartFooter.querySelector('.cart-breakdown');
    if (existingBreakdown) {
        existingBreakdown.remove();
    }

    if (serviceChargePercent > 0) {
        const breakdown = document.createElement('div');
        breakdown.className = 'cart-breakdown';
        breakdown.innerHTML = `
            <div class="cart-subtotal">
                <span>${translations[currentLanguage].order_total}</span>
                <span>${subtotal.toLocaleString()} ${translations[currentLanguage].sum}</span>
            </div>
            <div class="cart-service">
                <span>${translations[currentLanguage].service_charge} (${serviceChargePercent}%):</span>
                <span>${serviceCharge.toLocaleString()} ${translations[currentLanguage].sum}</span>
            </div>
        `;
        cartFooter.insertBefore(breakdown, cartFooter.querySelector('.cart-total'));
    }

    cartTotal.textContent = `${total.toLocaleString()} ${translations[currentLanguage].sum}`;
}

function getServiceChargePercent() {
    const urlParams = new URLSearchParams(window.location.search);

    // Service charge only applies in restaurant mode
    if (urlParams.has('restaurant') || urlParams.has('service')) {
        // Check if service charge is specified in URL (priority)
        if (urlParams.has('service')) {
            const serviceParam = urlParams.get('service');
            const servicePercent = parseInt(serviceParam);

            // Validate service charge (0-30%)
            if (!isNaN(servicePercent) && servicePercent >= 0 && servicePercent <= 30) {
                return servicePercent;
            }
        }

        // Default restaurant service charge from settings
        return parseInt(localStorage.getItem('gavhar_service_charge') || '10');
    }

    return 0; // No service charge for public access
}

async function openDishModal(dish) {
    const modal = document.getElementById('dishModal');
    const modalImage = document.getElementById('dishModalImage');
    const modalName = document.getElementById('dishModalName');
    const modalComposition = document.getElementById('dishModalComposition');
    const modalWeight = document.getElementById('dishModalWeight');
    const modalTime = document.getElementById('dishModalTime');
    const modalPrice = document.getElementById('dishModalPrice');
    const modalQuantity = document.getElementById('modalQuantity');

    if (modalImage) {
        modalImage.setAttribute('decoding', 'async');
        modalImage.setAttribute('loading', 'eager');
        modalImage.setAttribute('fetchpriority', 'high');
    }

    // If dish is light, fetch full details
    if (dish.__light) {
        try {
            const res = await fetch(`${API_BASE}/dishes/${dish.id}`, { cache: 'no-cache' });
            if (res.ok) {
                const json = await res.json();
                if (json && json.success && json.data) {
                    dish = json.data;
                }
            }
        } catch (e) {
            console.warn('Failed to load full dish details', e);
        }
    }

    // Set up image gallery - filter out null/empty images
    let imageArray = [];

    // Add main image if it exists
    if (dish.image) {
        imageArray.push(dish.image);
    }

    // Add gallery images if they exist
    if (dish.images && Array.isArray(dish.images)) {
        dish.images.forEach(img => {
            if (img && img.trim() !== '' && !imageArray.includes(img)) {
                imageArray.push(img);
            }
        });
    }

    // Fallback to main image or default image
    if (imageArray.length === 0) {
        imageArray = [dish.image || '/ELEMENTS/image 2.png'];
    }

    window.currentDishImages = imageArray;
    window.currentImageIndex = 0;

    modalImage.src = window.currentDishImages[0];
    modalName.textContent = dish.name[currentLanguage];
    modalComposition.textContent = dish.composition[currentLanguage];
    modalWeight.textContent = dish.weight;
    modalTime.textContent = dish.cookingTime;
    modalPrice.textContent = `${dish.price.toLocaleString()} сум`;

    const cartItem = cart.find(item => item.dishId === dish.id);
    modalQuantity.textContent = cartItem ? cartItem.quantity : 0;

    // Set up gallery navigation
    const prevButton = document.querySelector('.gallery-prev');
    const nextButton = document.querySelector('.gallery-next');
    const galleryNav = document.querySelector('.gallery-nav');

    // Show/hide navigation buttons based on image count
    if (window.currentDishImages.length <= 1) {
        if (galleryNav) galleryNav.style.display = 'none';
    } else {
        if (galleryNav) galleryNav.style.display = 'flex';
        if (prevButton) prevButton.style.display = 'flex';
        if (nextButton) nextButton.style.display = 'flex';
    }

    // Add image counter
    let imageCounter = document.querySelector('.image-counter');
    if (!imageCounter) {
        imageCounter = document.createElement('div');
        imageCounter.className = 'image-counter';
        imageCounter.style.cssText = `
            position: absolute;
            bottom: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
        `;
        document.querySelector('.dish-gallery').appendChild(imageCounter);
    }

    if (window.currentDishImages.length > 1) {
        imageCounter.textContent = `${window.currentImageIndex + 1} / ${window.currentDishImages.length}`;
        imageCounter.style.display = 'block';
    } else {
        imageCounter.style.display = 'none';
    }

    if (prevButton) {
        prevButton.onclick = () => {
            if (window.currentImageIndex > 0) {
                window.currentImageIndex--;
            } else {
                window.currentImageIndex = window.currentDishImages.length - 1;
            }
            modalImage.src = window.currentDishImages[window.currentImageIndex];

            // Update counter
            const counter = document.querySelector('.image-counter');
            if (counter) {
                counter.textContent = `${window.currentImageIndex + 1} / ${window.currentDishImages.length}`;
            }
        };
    }

    if (nextButton) {
        nextButton.onclick = () => {
            if (window.currentImageIndex < window.currentDishImages.length - 1) {
                window.currentImageIndex++;
            } else {
                window.currentImageIndex = 0;
            }
            modalImage.src = window.currentDishImages[window.currentImageIndex];

            // Update counter
            const counter = document.querySelector('.image-counter');
            if (counter) {
                counter.textContent = `${window.currentImageIndex + 1} / ${window.currentDishImages.length}`;
            }
        };
    }

    // Set up modal quantity controls
    document.getElementById('modalQuantityMinus').onclick = () => {
        changeQuantity(dish.id, -1);
        const updatedCartItem = cart.find(item => item.dishId === dish.id);
        modalQuantity.textContent = updatedCartItem ? updatedCartItem.quantity : 0;
    };

    document.getElementById('modalQuantityPlus').onclick = () => {
        changeQuantity(dish.id, 1);
        const updatedCartItem = cart.find(item => item.dishId === dish.id);
        modalQuantity.textContent = updatedCartItem ? updatedCartItem.quantity : 0;
    };

    modal.classList.add('active');
}

function closeDishModal() {
    document.getElementById('dishModal').classList.remove('active');
}


function performGlobalSearch(query) {
    console.log('Performing global search for:', query);
    console.log('All dishes count:', allDishes.length);

    // Ensure allDishes is populated
    if (allDishes.length === 0) {
        console.log('allDishes is empty, reloading data...');
        allDishes = [...dishes];
        if (allDishes.length === 0) {
            console.log('dishes is also empty, using sample data...');
            allDishes = [...sampleDishes];
        }
    }

    // Set global search mode
    window.isGlobalSearch = true;
    window.searchQuery = query;

    // Filter all dishes globally
    const qLower = String(query).toLocaleLowerCase('ru-RU');
    const searchResults = allDishes.filter(d => {
        const name = (d.name?.[currentLanguage] || '').toLocaleLowerCase('ru-RU');
        const comp = (d.composition?.[currentLanguage] || '').toLocaleLowerCase('ru-RU');
        return name.includes(qLower) || comp.includes(qLower);
    });

    console.log('Search results count:', searchResults.length);

    dishes = searchResults;
    renderDishes();
}

function filterDishes(query) {
    const allDishes = document.querySelectorAll('.card');

    allDishes.forEach(card => {
        const dishName = card.querySelector('p').textContent.toLocaleLowerCase('ru-RU');
        if (dishName.includes(query)) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function isAlcoholicAllowed() {
    // Check if current URL has special parameter for restaurant access
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('restaurant') || urlParams.has('admin');
}

function renderCategories() {
    const mainCategories = document.getElementById('mainCategories');
    mainCategories.innerHTML = '';

    // Filter categories based on alcohol policy
    const allowAlcohol = isAlcoholicAllowed();
    const visibleCategories = categories.filter(cat => !cat.isAlcoholic || allowAlcohol);

    visibleCategories.forEach((category, index) => {
        const button = document.createElement('button');
        button.className = 'main-category';
        button.setAttribute('data-category', category.key);
        button.textContent = category.name[currentLanguage];

        if (category.key === currentCategory) {
            button.classList.add('active');
        }

        if (selectedCategory && category.key === selectedCategory.key) {
            button.classList.add('selected');
        }

        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const key = e.currentTarget.getAttribute('data-category');
            const cat = categories.find(c => c.key === key);
            if (cat) {
                selectMainCategory(cat);
            }
        });

        mainCategories.appendChild(button);
    });

    console.log('Rendered categories:', visibleCategories.length);
    console.log('Current category:', currentCategory);
    console.log('Selected category:', selectedCategory);

    // После рендера включаем горизонтальный скролл колёсиком на десктопе
    enableHorizontalWheelScroll(mainCategories);
}

function selectMainCategory(category) {
    console.log('Selecting main category:', category.key, category.name.ru);

    // Ensure data is loaded
    if (typeof allDishes === 'undefined' || allDishes.length === 0) {
        console.log('Data not loaded, loading before category selection...');
        loadData().then(() => {
            selectMainCategoryInternal(category);
        });
        return;
    }

    selectMainCategoryInternal(category);
}

function selectMainCategoryInternal(category) {
    // Reset global search mode when selecting category
    window.isGlobalSearch = false;
    window.searchQuery = null;

    selectedCategory = category;
    currentCategory = category.key;
    currentSubcategory = null;

    // Update side title
    updateSideTitle(category.name[currentLanguage]);

    // Show subcategories if they exist
    if (category.subcategories && category.subcategories.length > 0) {
        console.log('Category has subcategories:', category.subcategories.length);
        renderSubcategories(category.key);
        showSubcategoriesContainer();
    } else {
        console.log('Category has no subcategories');
        hideSubcategoriesContainer();
    }

    // Render dishes
    console.log('About to render dishes for category:', currentCategory);
    renderDishes();

    // Update category buttons
    renderCategories();
}

function renderSubcategories(categoryKey) {
    const category = categories.find(cat => cat.key === categoryKey);
    if (!category || !category.subcategories) return;

    // Create subcategories container if it doesn't exist
    let subcategoriesContainer = document.querySelector('.subcategories-container');
    if (!subcategoriesContainer) {
        subcategoriesContainer = document.createElement('div');
        subcategoriesContainer.className = 'subcategories-container';

        const subcategoriesScroll = document.createElement('div');
        subcategoriesScroll.className = 'subcategories-scroll';
        subcategoriesContainer.appendChild(subcategoriesScroll);

        // Insert after the main categories
        const mainCategories = document.getElementById('mainCategories');
        mainCategories.parentNode.insertBefore(subcategoriesContainer, mainCategories.nextSibling);
    }

    const subcategoriesScroll = subcategoriesContainer.querySelector('.subcategories-scroll');
    subcategoriesScroll.innerHTML = '';

    // Add "All" option
    const allItem = document.createElement('div');
    allItem.className = 'subcategory-item';
    allItem.textContent = translations[currentLanguage].all;
    if (!currentSubcategory) {
        allItem.classList.add('active');
    }
    allItem.addEventListener('click', () => selectSubcategory(null));
    subcategoriesScroll.appendChild(allItem);

    category.subcategories.forEach(subcategory => {
        const subcategoryItem = document.createElement('div');
        subcategoryItem.className = 'subcategory-item';
        subcategoryItem.textContent = subcategory.name[currentLanguage];
        subcategoryItem.setAttribute('data-subcategory', subcategory.key);
        if (currentSubcategory === subcategory.key) {
            subcategoryItem.classList.add('active');
        }
        subcategoryItem.addEventListener('click', () => selectSubcategory(subcategory.key));
        subcategoriesScroll.appendChild(subcategoryItem);
    });
}

function showSubcategoriesContainer() {
    const container = document.querySelector('.subcategories-container');
    if (container) {
        container.classList.add('show');
    }
}

function hideSubcategoriesContainer() {
    const container = document.querySelector('.subcategories-container');
    if (container) {
        container.classList.remove('show');
    }
}

function selectSubcategory(subcategoryKey) {
    currentSubcategory = subcategoryKey;

    // Update active subcategory
    document.querySelectorAll('.subcategory-item').forEach(item => {
        item.classList.remove('active');
    });

    if (subcategoryKey) {
        const activeItem = document.querySelector(`[data-subcategory="${subcategoryKey}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    } else {
        // "All" option (first child)
        const allItem = document.querySelector('.subcategory-item:first-child');
        if (allItem) {
            allItem.classList.add('active');
        }
    }

    renderDishes();
}

function updateSideTitle(title) {
    const sideTitle = document.getElementById('sideTitle');
    if (sideTitle) {
        sideTitle.textContent = title.toUpperCase();
    }
}

function clearSelectedCategory() {
    selectedCategory = null;
    currentSubcategory = null;

    // Hide subcategories
    hideSubcategoriesContainer();

    // Reset to first category
    const allowAlcohol = isAlcoholicAllowed();
    const visibleCategories = categories.filter(cat => !cat.isAlcoholic || allowAlcohol);
    if (visibleCategories.length > 0) {
        selectMainCategory(visibleCategories[0]);
    }
}

function closeSubcategories() {
    document.getElementById('subcategoriesPanel').classList.remove('active');
}

// Slider functions
function initSlider() {
    // Вертикальный скролл — логика горизонтального слайдера отключена
}

function slideLeft() {
    const cardsContainer = document.getElementById('dishesGrid');
    const cards = cardsContainer.querySelectorAll('.card');
    const cardWidth = cards[0] ? cards[0].offsetWidth + 30 : 390; // card width + gap

    if (currentSlide > 0) {
        currentSlide--;
        cardsContainer.scrollTo({
            left: currentSlide * cardWidth,
            behavior: 'smooth'
        });
    }
}

function slideRight() {
    const cardsContainer = document.getElementById('dishesGrid');
    const cards = cardsContainer.querySelectorAll('.card');
    const cardWidth = cards[0] ? cards[0].offsetWidth + 30 : 390; // card width + gap
    const maxSlides = Math.max(0, cards.length - cardsPerView);

    if (currentSlide < maxSlides) {
        currentSlide++;
        cardsContainer.scrollTo({
            left: currentSlide * cardWidth,
            behavior: 'smooth'
        });
    }
}

// Export functions for global access
window.changeQuantity = changeQuantity;
window.closeSubcategories = closeSubcategories;
window.clearSelectedCategory = clearSelectedCategory;
