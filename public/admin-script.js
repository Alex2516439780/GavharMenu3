// Admin Panel JavaScript - only run in browser
if (typeof window !== 'undefined') {
    // Force cache refresh for this script
    if (window.location.search.includes('debug=1')) {
        console.log('🔄 Admin script loaded with debug mode - forcing cache refresh');
    }
let currentDishId = null;
let currentCategoryId = null;
let dishes = [];
let categories = [];
    let authToken = null;
    let pagination = { page: 1, pageSize: 24 };

    // Debug only in dev or when ?debug
    (function(){
        try {
            const isDevHost = /localhost|127\.0\.0\.1/.test(location.hostname);
            const urlDebug = new URLSearchParams(location.search).has('debug');
            if (!isDevHost && !urlDebug) {
                ['log','info','debug'].forEach(k => { try { console[k] = function(){}; } catch(_){} });
            }
            console.log('Admin script loaded');
        } catch(_){}
    })();

// API Base URL
const API_BASE = '/api';

// Authentication functions
async function login(username, password) {
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.data.token;
            localStorage.setItem('admin_token', authToken);
            return true;
    } else {
            throw new Error(data.error || 'Ошибка входа');
        }
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

function logout() {
    authToken = null;
    localStorage.removeItem('admin_token');
        showLoginModal();
    }

function isAuthenticated() {
    return authToken !== null;
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    let url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        cache: 'no-store',
        ...options
    };

    // Append cache-busting param for GET requests
    const method = (config.method || 'GET').toUpperCase();
    if (method === 'GET' && !/([?&])_t=/.test(url)) {
        url += (url.includes('?') ? '&' : '?') + `_t=${Date.now()}`;
    }

    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(url, config);
    let data = {};
    try {
        data = await response.json();
    } catch (e) {
        // no json body
    }

    // Handle auth errors globally
    if (response.status === 401 || response.status === 403) {
        // Clear token and force re-login
        authToken = null;
        localStorage.removeItem('admin_token');
        if (typeof showLoginModal === 'function') {
            showLoginModal();
        }
        throw new Error((data && data.error) || 'Недействительный токен. Войдите заново.');
    }

    if (!response.ok) {
        throw new Error((data && data.error) || `HTTP error! status: ${response.status}`);
    }

    return data;
}

// Load data functions
async function loadDishes() {
    try {
        const selectedCategory = document.getElementById('categorySelect')?.value || '';
        let url = '/dishes?restaurant=true';
        if (selectedCategory) {
            url += `&category=${encodeURIComponent(selectedCategory)}`;
        }
        // Запрашиваем лёгкий список без лишних полей
        url += (url.includes('?') ? '&' : '?') + 'light=1';
        // Параметры пагинации (сервер)
        const limit = pagination.pageSize;
        const offset = (pagination.page - 1) * pagination.pageSize;
        url += `&limit=${limit}&offset=${offset}`;
        const data = await apiRequest(url);
        dishes = data.data || [];
        // Если меняли фильтр — сбрасываем страницу
        if (offset === 0 && dishes.length === 0 && data.total > 0) {
            pagination.page = 1;
        }
        // Обновим пагинацию по данным сервера, если есть total
        if (typeof data.total === 'number') {
            pagination.total = data.total;
            pagination.pageSize = data.limit || limit;
        } else {
            pagination.total = dishes.length;
        }
        renderDishes();
    } catch (error) {
        console.error('Error loading dishes:', error);
        showError('Ошибка загрузки блюд: ' + error.message);
    }
}

async function loadCategories() {
    try {
        // облегчённая загрузка
        const data = await apiRequest('/categories?restaurant=true');
        categories = data.data || [];
        renderCategories();
        updateCategorySelects();
    } catch (error) {
        console.error('Error loading categories:', error);
        showError('Ошибка загрузки категорий: ' + error.message);
    }
}

// Settings tab removed: no-op
async function loadSettings() {}

// Render functions
function ensureDishesPaginationContainer() {
    let el = document.getElementById('dishesPagination');
    if (!el) {
        const list = document.getElementById('dishesList');
        if (!list || !list.parentElement) return null;
        el = document.createElement('div');
        el.id = 'dishesPagination';
        el.className = 'dishes-pagination';
        list.parentElement.insertBefore(el, list.nextSibling);
    }
    return el;
}

function renderDishesPagination(totalItems) {
    const container = ensureDishesPaginationContainer();
    if (!container) return;
    const totalPages = Math.max(1, Math.ceil((pagination.total || totalItems) / pagination.pageSize));
    const current = Math.min(pagination.page, totalPages);
    pagination.page = current;

    // Компактный рендер: Prev, несколько страниц вокруг текущей, Next
    const maxPagesToShow = 7;
    let start = Math.max(1, current - Math.floor(maxPagesToShow / 2));
    let end = Math.min(totalPages, start + maxPagesToShow - 1);
    start = Math.max(1, Math.min(start, end - maxPagesToShow + 1));

    let html = '<div class="pager">';
    html += `<button class="pager-btn" data-page="prev" ${current === 1 ? 'disabled' : ''}>‹</button>`;
    for (let p = start; p <= end; p++) {
        html += `<button class="pager-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`;
    }
    html += `<button class="pager-btn" data-page="next" ${current === totalPages ? 'disabled' : ''}>›</button>`;
    html += '</div>';
    container.innerHTML = html;
}

function renderDishes() {
    const container = document.getElementById('dishesList');
    if (!container) return;
    container.innerHTML = '';

    // Пагинация
    const total = dishes.length;
    const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
    if (pagination.page > totalPages) pagination.page = totalPages;
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const endIndex = Math.min(total, startIndex + pagination.pageSize);
    const pageSlice = dishes.slice(startIndex, endIndex);

    // Батч-рендер большими фрагментами, без частого reflow
    const fragment = document.createDocumentFragment();
    const batchSize = 40;
    const totalPageItems = pageSlice.length;
    let index = 0;
    const schedule = window.requestIdleCallback || function (cb) { return setTimeout(cb, 16); };

    function renderBatch(deadline) {
        let count = 0;
        while (index < totalPageItems && count < batchSize && (!deadline || deadline.timeRemaining() > 5)) {
            const dish = pageSlice[index++];
            const div = document.createElement('div');
            div.className = 'dish-item';
            const safeName = (dish.name && dish.name.ru) ? dish.name.ru : '';
            const imgUrl = dish.image || '/ELEMENTS/image 2.png';
            div.innerHTML = `
                <div class="dish-item-header">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <img loading="lazy" decoding="async" src="${imgUrl}" width="80" height="80" alt="${safeName}" class="dish-item-image" />
                        <div class="dish-item-info">
                            <div class="dish-item-name">${safeName}</div>
                            <div class="dish-item-category">${(dish.categoryName && dish.categoryName.ru) ? dish.categoryName.ru : (dish.category || '')}</div>
                            <div class="dish-item-price">${(dish.price != null ? Number(dish.price).toLocaleString() : '')} сум</div>
                            <div class="dish-status ${dish.inStock ? 'in-stock' : 'out-of-stock'}" style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 0.85em; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 8px;">
                                ${dish.inStock ? 'В наличии' : 'Нет в наличии'}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="dish-item-actions">
                    <button class="action-btn edit-btn" data-action="edit" data-id="${dish.id}">✏️ Редактировать</button>
                    <button class="action-btn delete-btn" data-action="delete" data-id="${dish.id}">🗑️ Удалить</button>
                    <button class="action-btn status-btn ${dish.inStock ? '' : 'inactive'}" data-action="toggle" data-id="${dish.id}">
                        ${dish.inStock ? '👁️ Скрыть' : '👁️ Показать'}
                    </button>
                </div>`;
            fragment.appendChild(div);
            count++;
        }

        if (index < totalPageItems) {
            schedule(renderBatch);
        } else {
            container.appendChild(fragment);
            renderDishesPagination(total);
        }
    }

    schedule(renderBatch);
}

function renderCategories() {
    const container = document.getElementById('categoriesList');
    if (!container) return;
    container.innerHTML = '';

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const el = document.createElement('div');
        el.className = 'category-item';
        const name = (category.name && category.name.ru) ? category.name.ru : '';
        const subsCount = Array.isArray(category.subcategories) ? category.subcategories.length : 0;
        el.innerHTML = `
            <div class="category-info">
                <h3>${name}</h3>
                <p class="category-key">Ключ: ${category.key}</p>
                <p class="category-subcategories">Подкатегории: ${subsCount}</p>
                <p class="category-alcohol ${category.isAlcoholic ? 'alcoholic' : 'non-alcoholic'}">
                    ${category.isAlcoholic ? 'Алкогольная' : 'Безалкогольная'}
                </p>
            </div>
            <div class="category-actions">
                <button class="action-btn edit-btn" data-action="edit-category" data-id="${category.id}">✏️ Редактировать</button>
                <button class="action-btn delete-btn" data-action="delete-category" data-id="${category.id}">🗑️ Удалить</button>
            </div>`;
        fragment.appendChild(el);
    }
    container.appendChild(fragment);
}

function updateCategorySelects() {
    const selects = document.querySelectorAll('#dishCategory, #categorySelect');
    selects.forEach(select => {
        const previousValue = select.value;
        if (select.id === 'categorySelect') {
            select.innerHTML = '<option value="">Все категории</option>';
        } else {
            select.innerHTML = '<option value="">Выберите категорию</option>';
        }
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.key;
            option.textContent = category.name.ru;
            select.appendChild(option);
        });
        // restore previous selection if exists
        if ([...select.options].some(o => o.value === previousValue)) {
            select.value = previousValue;
        }
    });
}

// Dish management
async function saveDish(dishData) {
    try {
        const response = await apiRequest('/dishes', {
            method: 'POST',
            body: JSON.stringify(dishData)
        });

        if (response.success) {
            showSuccess('Блюдо успешно добавлено');
            loadDishes();
            closeDishModal();
        } else {
            throw new Error(response.error || 'Ошибка добавления блюда');
        }
    } catch (error) {
        console.error('Ошибка сохранения блюда:', error);
        showError('Ошибка сохранения блюда: ' + error.message);
    }
}

async function updateDish(dishId, dishData) {
    try {
        const response = await apiRequest(`/dishes/${dishId}`, {
            method: 'PUT',
            body: JSON.stringify(dishData)
        });

        if (response.success) {
            showSuccess('Блюдо успешно обновлено');
            loadDishes();
            closeDishModal();  // Закрываем модал, но не очищаем форму
        } else {
            throw new Error(response.error || 'Ошибка обновления блюда');
        }
    } catch (error) {
        console.error('Ошибка обновления блюда:', error);
        showError('Ошибка обновления блюда: ' + error.message);
    }
}

async function deleteDish(dishId) {
    if (!confirm('Вы уверены, что хотите удалить это блюдо?')) return;

    try {
        const response = await apiRequest(`/dishes/${dishId}`, {
            method: 'DELETE'
        });

        if (response.success) {
            showSuccess('Блюдо успешно удалено');
            loadDishes();
    } else {
            throw new Error(response.error || 'Ошибка удаления блюда');
        }
    } catch (error) {
        console.error('Error deleting dish:', error);
        showError('Ошибка удаления блюда: ' + error.message);
    }
}

async function toggleDishStatus(dishId, buttonEl) {
    // Optimistic UI update
    let reverted = false;
    const btn = buttonEl || document.querySelector(`.status-btn[data-id="${dishId}"]`);
    const dishItem = btn ? btn.closest('.dish-item') : null;
    const statusBadge = dishItem ? dishItem.querySelector('.dish-status') : null;

    const wasInactive = btn ? btn.classList.contains('inactive') : false; // inactive => not in stock
    const optimisticInStock = wasInactive; // toggling: if inactive -> will be in stock

    if (btn && statusBadge) {
        // Apply optimistic state
        btn.classList.toggle('inactive', !optimisticInStock);
        btn.textContent = optimisticInStock ? '👁️ Скрыть' : '👁️ Показать';
        statusBadge.classList.toggle('in-stock', optimisticInStock);
        statusBadge.classList.toggle('out-of-stock', !optimisticInStock);
        statusBadge.textContent = optimisticInStock ? 'В наличии' : 'Нет в наличии';
    }

    try {
        const response = await apiRequest(`/dishes/${dishId}/toggle-status`, {
            method: 'PATCH'
        });

        if (response.success) {
            // Sync local data to response
            const idx = dishes.findIndex(d => d.id === dishId);
            if (idx !== -1) dishes[idx].inStock = !!response.data.inStock;
            showSuccess(`Блюдо ${response.data.inStock ? 'показано' : 'скрыто'}`);
            // Перезагрузка списка не требуется: UI уже обновлён оптимистично

            // Notify main menu about data change
            localStorage.setItem('gavhar_data_updated', Date.now().toString());
        } else {
            throw new Error(response.error || 'Ошибка изменения статуса');
        }
    } catch (error) {
        // Revert optimistic UI on error
        reverted = true;
        if (btn && statusBadge) {
            btn.classList.toggle('inactive', wasInactive);
            btn.textContent = wasInactive ? '👁️ Показать' : '👁️ Скрыть';
            statusBadge.classList.toggle('in-stock', !wasInactive);
            statusBadge.classList.toggle('out-of-stock', wasInactive);
            statusBadge.textContent = !wasInactive ? 'В наличии' : 'Нет в наличии';
        }
        console.error('Error toggling dish status:', error);
        showError('Ошибка изменения статуса: ' + error.message);
    }
}

// Category management
async function saveCategory(categoryData) {
    try {
        const response = await apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });

        if (response.success) {
            showSuccess('Категория успешно создана');
            loadCategories();
            closeCategoryModal();
        } else {
            throw new Error(response.error || 'Ошибка создания категории');
        }
    } catch (error) {
        console.error('Error saving category:', error);
        showError('Ошибка сохранения категории: ' + error.message);
    }
}

async function updateCategory(categoryId, categoryData) {
    try {
        const response = await apiRequest(`/categories/${categoryId}`, {
            method: 'PUT',
            body: JSON.stringify(categoryData)
        });

        if (response.success) {
            showSuccess('Категория успешно обновлена');
            loadCategories();
            closeCategoryModal();
        } else {
            throw new Error(response.error || 'Ошибка обновления категории');
        }
    } catch (error) {
        console.error('Error updating category:', error);
        showError('Ошибка обновления категории: ' + error.message);
    }
}

async function deleteCategory(categoryId) {
    if (!confirm('Вы уверены, что хотите удалить эту категорию?')) return;

    try {
        const response = await apiRequest(`/categories/${categoryId}`, {
            method: 'DELETE'
        });

        if (response.success) {
            showSuccess('Категория успешно удалена');
            loadCategories();
        } else {
            throw new Error(response.error || 'Ошибка удаления категории');
        }
    } catch (error) {
        console.error('Error deleting category:', error);
        showError('Ошибка удаления категории: ' + error.message);
    }
}

// Settings management removed (settings tab deleted)
async function saveSettings() {}

// Modal functions
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('adminContainer').style.display = 'none';
}

function hideLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('adminContainer').style.display = 'block';
}

function showDishModal(dishId = null) {
    console.log('🍽️ showDishModal called with ID:', dishId);
    currentDishId = dishId;
    const modal = document.getElementById('dishModal');
    const title = document.getElementById('modalTitle');

    console.log('Modal element found:', !!modal);
    console.log('Title element found:', !!title);

    // Always clear form first to prevent data leakage
    clearDishForm();

    if (dishId) {
        title.textContent = 'Редактировать блюдо';
        console.log('=== EDIT DISH MODAL OPENED ===');
        console.log('Dish ID for edit:', dishId);
        // Load dish data immediately after clearing
        console.log('=== CALLING loadDishForEdit ===');
        loadDishForEdit(dishId);
    } else {
        title.textContent = 'Добавить блюдо';
    }

    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        console.log('✅ Modal should be visible now');
    } else {
        console.error('❌ Modal element not found!');
    }
}

function closeDishModal() {
    document.getElementById('dishModal').style.display = 'none';
    currentDishId = null;

    // Clear gallery data when closing modal to prevent accumulation
    window.currentGalleryImages = [];
    window.currentMainImage = null;
}

function showCategoryModal(categoryId = null) {
    console.log('📁 showCategoryModal called with ID:', categoryId);
    currentCategoryId = categoryId;
    const modal = document.getElementById('categoryModal');
    const title = document.getElementById('categoryModalTitle');

    console.log('Category modal element found:', !!modal);
    console.log('Category title element found:', !!title);

    if (categoryId) {
        title.textContent = 'Редактировать категорию';
        loadCategoryForEdit(categoryId);
    } else {
        title.textContent = 'Добавить категорию';
        clearCategoryForm();
    }

    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
        console.log('✅ Category modal should be visible now');
    } else {
        console.error('❌ Category modal element not found!');
    }
}

function closeCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
    currentCategoryId = null;
}

// Form handling
function clearDishForm() {
    document.getElementById('dishForm').reset();

    // Clear previews safely
    const mainImagePreview = document.getElementById('mainImagePreview');
    const galleryPreview = document.getElementById('galleryPreview');

    if (mainImagePreview) mainImagePreview.innerHTML = '';
    if (galleryPreview) galleryPreview.innerHTML = '';

    // Clear global variables completely
    window.currentMainImage = null;
    window.currentGalleryImages = [];

    // Clear file inputs
    const mainImageInput = document.getElementById('dishImageFile');
    const galleryImagesInput = document.getElementById('dishImagesFiles');
    if (mainImageInput) mainImageInput.value = '';
    if (galleryImagesInput) galleryImagesInput.value = '';

    console.log('Form cleared, images reset');
}

function clearCategoryForm() {
    document.getElementById('categoryForm').reset();
    document.getElementById('subcategoriesManager').innerHTML = '';
}

// Edit functions
function editDish(dishId) {
    showDishModal(dishId);
}

function editCategory(categoryId) {
    showCategoryModal(categoryId);
}

async function loadDishForEdit(dishId) {
    console.log('=== loadDishForEdit CALLED ===');
    console.log('Dish ID:', dishId);
    console.log('Current dishes array length:', dishes.length);
    try {
        console.log('Loading dish for edit, ID:', dishId);
        console.log('Current dishes array length:', dishes.length);

        // Показываем уведомление для отладки (убираем, так как оно мешает)
        // showSuccess('Начинаем загрузку блюда ID: ' + dishId);

        // Инициализируем токен из localStorage если он не установлен
        if (!authToken) {
            const savedToken = localStorage.getItem('admin_token');
            if (savedToken) {
                authToken = savedToken;
                console.log('Токен восстановлен из localStorage');
            }
        }

        // Проверяем аутентификацию
        if (!isAuthenticated()) {
            console.error('User not authenticated');
            showError('Необходимо войти в систему');
            return;
        }

        // ВСЕГДА загружаем с сервера, чтобы получить полные данные (включая weight, cookingTime, composition, images)
        // Локальный массив содержит только легкие данные (без этих полей)
        console.log('Always loading from server to get full dish data...');
        const response = await apiRequest(`/dishes/${dishId}`);
        if (response.success) {
            dish = response.data;
            console.log('Полный объект блюда с сервера:', JSON.stringify(dish, null, 2));
        } else {
            throw new Error(response.error || 'Блюдо не найдено');
        }

        console.log('Значение dish.weight:', dish.weight);
        console.log('Значение dish.cookingTime:', dish.cookingTime);
        console.log('Значение dish.composition:', dish.composition);
        console.log('Значение dish.images:', dish.images);

        console.log('Filling form with dish data:', dish);

        try {
            const nameRuField = document.getElementById('dishNameRu');
            const nameUzField = document.getElementById('dishNameUz');
            const nameEnField = document.getElementById('dishNameEn');
            const categoryField = document.getElementById('dishCategory');
            const priceField = document.getElementById('dishPrice');
            const orderField = document.getElementById('dishOrder');
            const weightField = document.getElementById('dishWeight');
            const timeField = document.getElementById('dishTime');
            const compRuField = document.getElementById('dishCompositionRu');
            const compUzField = document.getElementById('dishCompositionUz');
            const compEnField = document.getElementById('dishCompositionEn');

            if (nameRuField) {
                nameRuField.value = (dish.name && dish.name.ru) ? dish.name.ru : '';
            }
            if (nameUzField) {
                nameUzField.value = (dish.name && dish.name.uz) ? dish.name.uz : '';
            }
            if (nameEnField) {
                nameEnField.value = (dish.name && dish.name.en) ? dish.name.en : '';
            }
            if (categoryField) {
                categoryField.value = dish.category || '';
            }
            if (priceField) {
                priceField.value = dish.price || '';
            }
            if (orderField) {
                orderField.value = dish.order !== undefined ? dish.order : 1;
            }
            if (weightField) {
                weightField.value = dish.weight || '';
            }
            if (timeField) {
                timeField.value = dish.cookingTime || '';
            }
            if (compRuField) {
                compRuField.value = (dish.composition && dish.composition.ru) ? dish.composition.ru : '';
            }
            if (compUzField) {
                compUzField.value = (dish.composition && dish.composition.uz) ? dish.composition.uz : '';
            }
            if (compEnField) {
                compEnField.value = (dish.composition && dish.composition.en) ? dish.composition.en : '';
            }

            const inStockCheckbox = document.getElementById('dishInStock');
            const isAlcoholicCheckbox = document.getElementById('dishIsAlcoholic');
            if (inStockCheckbox) {
                inStockCheckbox.checked = !!dish.inStock;
            }
            if (isAlcoholicCheckbox) {
                isAlcoholicCheckbox.checked = !!dish.isAlcoholic;
            }

            console.log('Form filled successfully');
        } catch (error) {
            console.error('Error filling form:', error);
        }

        // Update subcategories first
        updateSubcategorySelect(dish.category);

        // Then set subcategory value after a small delay to ensure options are loaded
        setTimeout(() => {
            const subcategorySelect = document.getElementById('dishSubcategory');
            if (subcategorySelect && dish.subcategory) {
                subcategorySelect.value = dish.subcategory;
            }
        }, 100);

        // Load existing images
        if (dish.image) {
            console.log('Loading main image:', dish.image);
            // Ищем лучшее превью: 400 → 200 → 100 для быстрой загрузки
            resolveOptimizedPreviewUrl(dish.image, [400, 200, 100]).then(async (imageUrl) => {
                const usageCount = await checkImageUsage(dish.image);
                const mainImageData = {
                    url: dish.image, // Оригинальный URL для сохранения
                    thumbUrl: imageUrl, // Оптимизированный URL для превью
                    originalName: 'Существующее изображение',
                    filename: dish.image.split('/').pop(),
                    usedInDishes: usageCount > 1 ? usageCount : 0 // Показываем только если используется в других блюдах
                };
                window.currentMainImage = mainImageData;
                updateMainImagePreview(mainImageData);
            });
        }

        if (dish.images && dish.images.length > 0) {
            console.log('Loading gallery images:', dish.images.length);

            // Для миниатюр галереи используем 200 → 100 для быстрой загрузки
            Promise.all(dish.images.map(async (url) => {
                const resolved = await resolveOptimizedPreviewUrl(url, [200, 100]);
                const usageCount = await checkImageUsage(url);
                return {
                    url: url, // Оригинальный URL для сохранения
                    thumbUrl: resolved, // Оптимизированный URL для превью
                    originalName: 'Существующее изображение',
                    filename: url.split('/').pop(),
                    usedInDishes: usageCount > 1 ? usageCount : 0 // Показываем только если используется в других блюдах
                };
            })).then(galleryData => {
                window.currentGalleryImages = galleryData;
                updateGalleryImagesPreview([]);
            });
        }

        console.log('Dish loaded successfully for edit');

    } catch (error) {
        console.error('Error loading dish for edit:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        showError('Ошибка загрузки данных блюда: ' + error.message);
    }
}

async function loadCategoryForEdit(categoryId) {
    try {
        const category = categories.find(c => c.id === categoryId);
        if (!category) return;

        // Fill form with category data
        document.getElementById('categoryNameRu').value = category.name.ru;
        document.getElementById('categoryNameUz').value = category.name.uz;
        document.getElementById('categoryNameEn').value = category.name.en;
        document.getElementById('categoryKey').value = category.key;
        document.getElementById('categoryIsAlcoholic').checked = category.isAlcoholic;

        // Load subcategories
        loadSubcategoriesForEdit(category.subcategories);

    } catch (error) {
        console.error('Error loading category for edit:', error);
        showError('Ошибка загрузки данных категории');
    }
}

// Utility functions
function updateSubcategorySelect(categoryKey) {
    const subcategorySelect = document.getElementById('dishSubcategory');
    subcategorySelect.innerHTML = '<option value="">Выберите подкатегорию</option>';

    const category = categories.find(c => c.key === categoryKey);
    if (category && category.subcategories) {
        category.subcategories.forEach(sub => {
            const option = document.createElement('option');
            option.value = sub.key;
            option.textContent = sub.name.ru;
            subcategorySelect.appendChild(option);
        });
    }
}

function loadSubcategoriesForEdit(subcategories) {
    const container = document.getElementById('subcategoriesManager');
        container.innerHTML = '';

    subcategories.forEach((sub, index) => {
        addSubcategoryRow(sub, index);
    });
}

function addSubcategoryRow(subcategory = null, index = 0) {
    const container = document.getElementById('subcategoriesManager');
    const row = document.createElement('div');
    row.className = 'subcategory-row';
    row.innerHTML = `
        <input type="text" placeholder="Ключ подкатегории" value="${subcategory?.key || ''}" class="subcategory-key" />
        <input type="text" placeholder="Название (RU)" value="${subcategory?.name?.ru || ''}" class="subcategory-name-ru" />
        <input type="text" placeholder="Название (UZ)" value="${subcategory?.name?.uz || ''}" class="subcategory-name-uz" />
        <input type="text" placeholder="Название (EN)" value="${subcategory?.name?.en || ''}" class="subcategory-name-en" />
        <button type="button" class="remove-subcategory-btn" data-action="remove-subcategory">×</button>
    `;
    container.appendChild(row);
}

function removeSubcategoryRow(button) {
    button.parentElement.remove();
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== PAGE LOADED ===');
    console.log('DOM Content Loaded');
    console.log('🔄 Page loaded at:', new Date().toISOString());

    // Clear any existing gallery data to prevent accumulation
    window.currentGalleryImages = [];
    window.currentMainImage = null;

    // Check if already authenticated
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
        authToken = savedToken;
        console.log('Token found, showing main content');
        hideLoginModal();
        loadData();
    } else {
        console.log('No token, showing login modal');
        showLoginModal();
    }

    // Login form
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            await login(username, password);
            hideLoginModal();
            loadData();
        } catch (error) {
            showError('Ошибка входа: ' + error.message);
        }
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Refresh menu
    document.getElementById('refreshMenuBtn').addEventListener('click', function() {
        // Force update timestamp
        localStorage.setItem('gavhar_data_updated', Date.now().toString());

        // Open menu in new tab
        window.open('menu.html', '_blank');

        showSuccess('Меню обновлено! Откройте новую вкладку для просмотра изменений.');
    });


    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const section = this.dataset.section;
            showSection(section);
        });
    });

    // Category filter for dishes list
    const categoryFilter = document.getElementById('categorySelect');
    if (categoryFilter) {
        const debounced = debounce(function() {
            loadDishes();
        }, 200);
        categoryFilter.addEventListener('change', debounced);
    }

    // Dish form
    document.getElementById('dishForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        // Защита от множественных отправок
        if (this.isSubmitting) {
            console.log('Форма уже отправляется, пропускаем...');
            return;
        }
        this.isSubmitting = true;

        // Debug gallery data
    console.log('=== СОХРАНЕНИЕ БЛЮДА ===');
    console.log('Основное изображение:', window.currentMainImage);
    console.log('Галерея изображений:', window.currentGalleryImages);
    console.log('Количество в галерее:', window.currentGalleryImages ? window.currentGalleryImages.length : 0);

    const formData = {
        name: {
            ru: document.getElementById('dishNameRu').value,
            uz: document.getElementById('dishNameUz').value,
            en: document.getElementById('dishNameEn').value
        },
        category: document.getElementById('dishCategory').value,
            subcategory: document.getElementById('dishSubcategory').value,
        price: parseInt(document.getElementById('dishPrice').value),
        order: parseInt(document.getElementById('dishOrder').value) || 1,
        weight: document.getElementById('dishWeight').value,
        cookingTime: document.getElementById('dishTime').value,
        composition: {
            ru: document.getElementById('dishCompositionRu').value,
            uz: document.getElementById('dishCompositionUz').value,
            en: document.getElementById('dishCompositionEn').value
        },
        inStock: document.getElementById('dishInStock').checked,
        isAlcoholic: document.getElementById('dishIsAlcoholic').checked,
        // Add image data
        image: window.currentMainImage ? window.currentMainImage.url : null,
        images: window.currentGalleryImages ? window.currentGalleryImages.map(img => img.url) : []
    };

    console.log('Данные для сохранения:');
    console.log('- Основное изображение:', formData.image);
    console.log('- Галерея (images):', formData.images);
    console.log('========================');

    try {
        if (currentDishId) {
            await updateDish(currentDishId, formData);
        } else {
            await saveDish(formData);
        }
    } catch (error) {
        console.error('Ошибка сохранения блюда:', error);
        showError('Ошибка сохранения блюда: ' + error.message);
    } finally {
        // Сбрасываем флаг отправки
        this.isSubmitting = false;
    }
    });

    // Category form
    document.getElementById('categoryForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const subcategories = [];
        document.querySelectorAll('.subcategory-row').forEach(row => {
            const key = row.querySelector('.subcategory-key').value;
            const nameRu = row.querySelector('.subcategory-name-ru').value;
            const nameUz = row.querySelector('.subcategory-name-uz').value;
            const nameEn = row.querySelector('.subcategory-name-en').value;

            if (key && nameRu && nameUz && nameEn) {
            subcategories.push({
                    key,
                    name: { ru: nameRu, uz: nameUz, en: nameEn }
            });
        }
    });

        const formData = {
            key: document.getElementById('categoryKey').value,
        name: {
            ru: document.getElementById('categoryNameRu').value,
            uz: document.getElementById('categoryNameUz').value,
            en: document.getElementById('categoryNameEn').value
        },
        isAlcoholic: document.getElementById('categoryIsAlcoholic').checked,
            subcategories
    };

    if (currentCategoryId) {
            await updateCategory(currentCategoryId, formData);
    } else {
            await saveCategory(formData);
        }
    });

    // Settings removed

    // Modal close buttons
    document.getElementById('closeDishModal').addEventListener('click', closeDishModal);
    document.getElementById('closeCategoryModal').addEventListener('click', closeCategoryModal);
    document.getElementById('cancelDishBtn').addEventListener('click', closeDishModal);
    document.getElementById('cancelCategoryBtn').addEventListener('click', closeCategoryModal);

    // Add buttons
    document.getElementById('addDishBtn').addEventListener('click', () => showDishModal());
    document.getElementById('addCategoryBtn').addEventListener('click', () => showCategoryModal());
    document.getElementById('addSubcategoryBtn').addEventListener('click', () => addSubcategoryRow());

    // Category change handler
    document.getElementById('dishCategory').addEventListener('change', function() {
        updateSubcategorySelect(this.value);
    });

    // File upload handlers
    const mainImageInput = document.getElementById('dishImageFile');
    const galleryImagesInput = document.getElementById('dishImagesFiles');

    if (mainImageInput) {
        mainImageInput.addEventListener('change', handleMainImageUpload);
    }

    if (galleryImagesInput) {
        galleryImagesInput.addEventListener('change', handleGalleryImagesUpload);
    }

    // Event delegation for dynamic buttons
    document.addEventListener('click', function(e) {
        if (e.target.matches('[data-action]')) {
            const action = e.target.dataset.action;
            const id = parseInt(e.target.dataset.id);
            const index = parseInt(e.target.dataset.index);

            console.log('🔘 Button clicked:', {
                action: action,
                id: id,
                index: index,
                element: e.target.tagName,
                className: e.target.className
            });

            switch(action) {
                case 'edit':
                    editDish(id);
                    break;
                case 'delete':
                    deleteDish(id);
                    break;
                case 'toggle':
                    toggleDishStatus(id, e.target);
                    break;
                case 'edit-category':
                    editCategory(id);
                    break;
                case 'delete-category':
                    deleteCategory(id);
                    break;
                case 'remove-subcategory':
                    removeSubcategoryRow(e.target);
                    break;
                case 'remove-main-image':
                    removeMainImage();
                    break;
                case 'remove-gallery-image':
                    removeGalleryImage(index);
                    break;
                case 'close-notification':
                    e.target.closest('.notification').remove();
                    break;
            }
        }
        // Пагинация
        if (e.target.matches('#dishesPagination [data-page]')) {
            const val = e.target.getAttribute('data-page');
            const totalPages = Math.max(1, Math.ceil(dishes.length / pagination.pageSize));
            if (val === 'prev' && pagination.page > 1) {
                pagination.page -= 1;
                renderDishes();
            } else if (val === 'next' && pagination.page < totalPages) {
                pagination.page += 1;
                renderDishes();
            } else {
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 1 && num <= totalPages && num !== pagination.page) {
                    pagination.page = num;
                    renderDishes();
                }
            }
        }
    });
});

// File upload functions
async function uploadImage(file, isMainImage = false) {
    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch('/api/upload/single', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            return result.data;
        } else {
            throw new Error(result.error || 'Ошибка загрузки файла');
        }
    } catch (error) {
        console.error('Ошибка загрузки изображения:', error);
        showError('Ошибка загрузки изображения: ' + error.message);
        return null;
    }
}

async function uploadImages(files) {
    try {
        const formData = new FormData();
        Array.from(files).forEach(file => {
            formData.append('images', file);
        });

        const response = await fetch('/api/upload/multiple', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('admin_token')}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            return result.data;
        } else {
            throw new Error(result.error || 'Ошибка загрузки файлов');
        }
    } catch (error) {
        console.error('Ошибка загрузки изображений:', error);
        showError('Ошибка загрузки изображений: ' + error.message);
        return [];
    }
}

// File upload handlers
async function handleMainImageUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('Main image file selected:', file);

    // Check file size (15MB)
    if (file.size > 15 * 1024 * 1024) {
        showError('Файл слишком большой. Максимальный размер: 15MB');
        return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
        showError('Разрешены только изображения');
        return;
    }

    try {
        showNotification('Загружаем изображение...', 'info');
        console.log('Starting upload...');

        const uploadedFile = await uploadImage(file, true);
        console.log('Upload result:', uploadedFile);

        if (uploadedFile) {
            // Update preview
            updateMainImagePreview(uploadedFile);
            showSuccess('Основное изображение загружено');
        } else {
            showError('Не удалось загрузить изображение');
        }
    } catch (error) {
        console.error('Upload error:', error);
        showError('Ошибка загрузки основного изображения: ' + error.message);
    }
}

async function handleGalleryImagesUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check file sizes
    for (let file of files) {
        if (file.size > 15 * 1024 * 1024) {
            showError(`Файл ${file.name} слишком большой. Максимальный размер: 15MB`);
            return;
        }
        if (!file.type.startsWith('image/')) {
            showError(`Файл ${file.name} не является изображением`);
            return;
        }
    }

    try {
        showNotification('Загружаем изображения галереи...', 'info');

        const uploadedFiles = await uploadImages(files);
        if (uploadedFiles.length > 0) {
            // Update preview
            updateGalleryImagesPreview(uploadedFiles);
            showSuccess(`${uploadedFiles.length} изображений загружено в галерею`);
        }
    } catch (error) {
        showError('Ошибка загрузки изображений галереи');
    }
}

function updateMainImagePreview(uploadedFile) {
    const previewContainer = document.getElementById('mainImagePreview');
    if (!previewContainer) {
        console.error('mainImagePreview container not found');
        return;
    }

    console.log('Updating main image preview:', uploadedFile);

    // Используем thumbUrl для превью, если доступен, иначе оригинал
    const previewUrl = uploadedFile.thumbUrl || uploadedFile.url;

    previewContainer.innerHTML = `
        <div class="preview-item main-preview">
            <img src="${previewUrl}" alt="Основное изображение" style="max-width: 300px; max-height: 300px; width: auto; height: auto; object-fit: contain; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <button type="button" class="remove-image-btn" data-action="remove-main-image">×</button>
            <div class="preview-filename">${uploadedFile.originalName}</div>
            ${uploadedFile.usedInDishes ? `<div class="image-usage-info" style="margin-top: 5px; font-size: 11px; color: #ff9800;">⚠️ Используется в ${uploadedFile.usedInDishes} блюдах</div>` : ''}
        </div>
    `;

    // Store the uploaded file data
    window.currentMainImage = uploadedFile;
}

function updateGalleryImagesPreview(uploadedFiles) {
    const previewContainer = document.getElementById('galleryPreview');
    if (!previewContainer) {
        console.error('galleryPreview container not found');
        return;
    }

    // Initialize if not exists
    if (!window.currentGalleryImages) {
        window.currentGalleryImages = [];
    }

    // Add new files only if they are provided and not empty
    if (uploadedFiles && uploadedFiles.length > 0) {
        window.currentGalleryImages.push(...uploadedFiles);
    }

    console.log('Updating gallery preview:', window.currentGalleryImages);

    // Update preview
    previewContainer.innerHTML = window.currentGalleryImages.map((file, index) => {
        // Используем thumbUrl для превью, если доступен
        const previewUrl = file.thumbUrl || file.url;

        return `
        <div class="preview-item">
            <img src="${previewUrl}" alt="Галерея ${index + 1}" style="max-width: 180px; max-height: 180px; width: auto; height: auto; object-fit: contain; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
            <button type="button" class="remove-image-btn" data-action="remove-gallery-image" data-index="${index}">×</button>
            <div class="preview-filename">${file.originalName || 'Изображение'}</div>
            ${file.usedInDishes ? `<div class="image-usage-info" style="margin-top: 3px; font-size: 10px; color: #ff9800;">⚠️ В ${file.usedInDishes} блюдах</div>` : ''}
        </div>
    `}).join('');
}

async function removeMainImage() {
    const previewContainer = document.getElementById('mainImagePreview');

    // Если это сохраненное изображение (при редактировании), удаляем с сервера
    if (window.currentMainImage && window.currentMainImage.filename) {
        try {
            const response = await apiRequest(`/upload/${window.currentMainImage.filename}`, {
                method: 'DELETE'
            });

            if (response.success) {
                showSuccess('Изображение удалено с сервера');
            }
        } catch (error) {
            console.error('Ошибка удаления изображения:', error);
            showError('Не удалось удалить изображение с сервера');
        }
    }

    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
    window.currentMainImage = null;

    // Clear the input
    const input = document.getElementById('dishImageFile');
    if (input) input.value = '';
}

async function removeGalleryImage(index) {
    if (window.currentGalleryImages && window.currentGalleryImages[index]) {
        const image = window.currentGalleryImages[index];

        // Если это сохраненное изображение (при редактировании), удаляем с сервера
        if (image.filename) {
            try {
                const response = await apiRequest(`/upload/${image.filename}`, {
                    method: 'DELETE'
                });

                if (response.success) {
                    showSuccess('Изображение удалено с сервера');
                }
            } catch (error) {
                console.error('Ошибка удаления изображения:', error);
                showError('Не удалось удалить изображение с сервера');
            }
        }

        window.currentGalleryImages.splice(index, 1);
        updateGalleryImagesPreview([]);
    }
}

// Helper function to check image usage in dishes
async function checkImageUsage(imageUrl) {
    try {
        let usageCount = 0;
        const filename = imageUrl.split('/').pop();

        // Проверяем все блюда на использование этого изображения
        for (const dish of dishes) {
            // Проверяем основное изображение
            if (dish.image && dish.image.includes(filename)) {
                usageCount++;
            }

            // Проверяем галерею изображений
            if (dish.images && Array.isArray(dish.images)) {
                for (const img of dish.images) {
                    if (img && img.includes(filename)) {
                        usageCount++;
                        break; // Считаем только один раз для каждого блюда
                    }
                }
            }
        }

        return usageCount;
    } catch (error) {
        console.error('Error checking image usage:', error);
        return 0;
    }
}

// Helper functions
function getOptimizedImageUrl(originalUrl, preferredWidth) {
    if (!originalUrl) return originalUrl;

    // Если это внешний URL, возвращаем как есть
    if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
        return originalUrl;
    }

    // Извлекаем имя файла без расширения
    const urlPath = originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`;
    const baseName = urlPath.split('/').pop();
    const dotIndex = baseName.lastIndexOf('.');
    const nameOnly = dotIndex > -1 ? baseName.substring(0, dotIndex) : baseName;
    const dirPath = urlPath.substring(0, urlPath.lastIndexOf('/'));

    // Выбираем подходящий размер для превью
    let targetWidth = preferredWidth;
    if (preferredWidth <= 200) targetWidth = 200;
    else if (preferredWidth <= 400) targetWidth = 400;
    else if (preferredWidth <= 800) targetWidth = 800;
    else targetWidth = 800; // Максимум 800px для превью

    // Возвращаем только сформированный путь (без проверки существования)
    return `${dirPath}/${nameOnly}-${targetWidth}.webp`;
}

// Подбор лучшего доступного превью: перебирает кандидатов и возвращает первый существующий (webp/avif), иначе оригинал
async function resolveOptimizedPreviewUrl(originalUrl, candidateWidths) {
    try {
        if (!originalUrl) return originalUrl;
        if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) return originalUrl;

        const urlPath = originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`;
        const baseName = urlPath.split('/').pop();
        const dotIndex = baseName.lastIndexOf('.');
        const nameOnly = dotIndex > -1 ? baseName.substring(0, dotIndex) : baseName;
        const dirPath = urlPath.substring(0, urlPath.lastIndexOf('/'));

        // Порядок форматов: webp → avif (чаще webp есть)
        for (const width of candidateWidths) {
            const candidates = [
                `${dirPath}/${nameOnly}-${width}.webp`,
                `${dirPath}/${nameOnly}-${width}.avif`
            ];
            for (const candidate of candidates) {
                try {
                    const res = await fetch(candidate, { method: 'HEAD' });
                    if (res.ok) return candidate;
                } catch (_) {
                    // ignore and try next
                }
            }
        }
        return originalUrl;
    } catch (_) {
        return originalUrl;
    }
}

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionName + 'Section').classList.add('active');

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
}

async function loadData() {
    await Promise.all([
        loadDishes(),
        loadCategories()
    ]);
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" data-action="close-notification">×</button>
        </div>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease;
        max-width: 400px;
    `;

    document.body.appendChild(notification);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Add CSS for animations - only if document is available (browser environment)
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .notification-close {
            background: none;
            border: none;
            color: white;
            font-size: 18px;
            cursor: pointer;
            margin-left: auto;
        }
        #dishesPagination { display: flex; justify-content: center; margin: 16px 0; }
        #dishesPagination .pager { display: flex; gap: 6px; }
        #dishesPagination .pager-btn {
            background: #2d5a47; color: #d4af37; border: 2px solid #d4af37;
            padding: 6px 12px; border-radius: 10px; cursor: pointer; font-weight: 600;
        }
        #dishesPagination .pager-btn.active { background: #d4af37; color: #1a3d2e; }
        #dishesPagination .pager-btn[disabled] { opacity: .5; cursor: default; }
    `;
    document.head.appendChild(style);
}

// Global functions for onclick handlers - only in browser environment
if (typeof window !== 'undefined') {
    window.editDish = function(dishId) {
        console.log('Edit dish clicked:', dishId);
        showDishModal(dishId);
    };

    window.deleteDish = function(dishId) {
        console.log('Delete dish clicked:', dishId);
        if (!confirm('Вы уверены, что хотите удалить это блюдо?')) return;

        apiRequest(`/dishes/${dishId}`, {
            method: 'DELETE'
        }).then(response => {
            if (response.success) {
                showSuccess('Блюдо успешно удалено');
                loadDishes();
    } else {
                throw new Error(response.error || 'Ошибка удаления блюда');
            }
        }).catch(error => {
            console.error('Error deleting dish:', error);
            showError('Ошибка удаления блюда: ' + error.message);
        });
    };

    window.toggleDishStatus = function(dishId) {
        console.log('Toggle dish status clicked:', dishId);
        const btn = document.querySelector(`.status-btn[data-id="${dishId}"]`);
        toggleDishStatus(dishId, btn);
    };

    window.editCategory = function(categoryId) {
        showCategoryModal(categoryId);
    };

    window.deleteCategory = function(categoryId) {
        if (!confirm('Вы уверены, что хотите удалить эту категорию?')) return;

        apiRequest(`/categories/${categoryId}`, {
            method: 'DELETE'
        }).then(response => {
            if (response.success) {
                showSuccess('Категория успешно удалена');
                loadCategories();
            } else {
                throw new Error(response.error || 'Ошибка удаления категории');
            }
        }).catch(error => {
            console.error('Error deleting category:', error);
            showError('Ошибка удаления категории: ' + error.message);
        });
    };

    window.removeSubcategoryRow = function(button) {
        button.parentElement.remove();
    };
}

    // Debug: Check if global functions are available
    console.log('Global functions defined:', {
        editDish: typeof window.editDish,
        deleteDish: typeof window.deleteDish,
        toggleDishStatus: typeof window.toggleDishStatus,
        editCategory: typeof window.editCategory,
        deleteCategory: typeof window.deleteCategory
    });
}

// Utils
function debounce(fn, delay) {
    let timerId;
    return function() {
        const ctx = this, args = arguments;
        clearTimeout(timerId);
        timerId = setTimeout(function(){ fn.apply(ctx, args); }, delay);
    };
}
