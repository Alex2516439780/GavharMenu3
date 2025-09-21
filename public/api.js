// REST API Structure for GAVHAR Restaurant Menu
// This file provides a simple API structure for the frontend

class GavharAPI {
    constructor() {
        this.baseUrl = window.location.origin;
        this.endpoints = {
            categories: '/api/categories',
            dishes: '/api/dishes',
            settings: '/api/settings'
        };
    }

    // Generic HTTP request method
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            // Fallback to localStorage for demo purposes
            return this.fallbackToLocalStorage(endpoint, options);
        }
    }

    // Fallback to localStorage when API is not available
    fallbackToLocalStorage(endpoint, options) {
        const method = options.method || 'GET';

        if (endpoint.includes('/categories')) {
            return this.handleCategoriesLocal(method, options.body);
        } else if (endpoint.includes('/dishes')) {
            return this.handleDishesLocal(method, options.body);
        } else if (endpoint.includes('/settings')) {
            return this.handleSettingsLocal(method, options.body);
        }

        return { error: 'Endpoint not found' };
    }

    // Categories API methods
    async getCategories() {
        return this.request(this.endpoints.categories);
    }

    async createCategory(categoryData) {
        return this.request(this.endpoints.categories, {
            method: 'POST',
            body: JSON.stringify(categoryData)
        });
    }

    async updateCategory(categoryId, categoryData) {
        return this.request(`${this.endpoints.categories}/${categoryId}`, {
            method: 'PUT',
            body: JSON.stringify(categoryData)
        });
    }

    async deleteCategory(categoryId) {
        return this.request(`${this.endpoints.categories}/${categoryId}`, {
            method: 'DELETE'
        });
    }

    // Dishes API methods
    async getDishes(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `${this.endpoints.dishes}?${queryString}` : this.endpoints.dishes;
        return this.request(endpoint);
    }

    async getDishesByCategory(categoryKey) {
        return this.getDishes({ category: categoryKey });
    }

    async getDishesBySubcategory(categoryKey, subcategoryKey) {
        return this.getDishes({ category: categoryKey, subcategory: subcategoryKey });
    }

    async getDish(dishId) {
        return this.request(`${this.endpoints.dishes}/${dishId}`);
    }

    async createDish(dishData) {
        return this.request(this.endpoints.dishes, {
            method: 'POST',
            body: JSON.stringify(dishData)
        });
    }

    async updateDish(dishId, dishData) {
        return this.request(`${this.endpoints.dishes}/${dishId}`, {
            method: 'PUT',
            body: JSON.stringify(dishData)
        });
    }

    async deleteDish(dishId) {
        return this.request(`${this.endpoints.dishes}/${dishId}`, {
            method: 'DELETE'
        });
    }

    async toggleDishStatus(dishId) {
        return this.request(`${this.endpoints.dishes}/${dishId}/toggle-status`, {
            method: 'PATCH'
        });
    }

    // Settings API methods
    async getSettings() {
        return this.request(this.endpoints.settings);
    }

    async updateSettings(settingsData) {
        return this.request(this.endpoints.settings, {
            method: 'PUT',
            body: JSON.stringify(settingsData)
        });
    }

    // LocalStorage fallback methods
    handleCategoriesLocal(method, body) {
        const categories = JSON.parse(localStorage.getItem('gavhar_categories') || '[]');

        switch (method) {
            case 'GET':
                return { data: categories, success: true };

            case 'POST':
                const newCategory = JSON.parse(body);
                newCategory.id = Date.now();
                categories.push(newCategory);
                localStorage.setItem('gavhar_categories', JSON.stringify(categories));
                return { data: newCategory, success: true };

            case 'PUT':
                // Handle update logic
                return { success: true };

            case 'DELETE':
                // Handle delete logic
                return { success: true };

            default:
                return { error: 'Method not supported' };
        }
    }

    handleDishesLocal(method, body) {
        const dishes = JSON.parse(localStorage.getItem('gavhar_dishes') || '[]');

        switch (method) {
            case 'GET':
                return { data: dishes, success: true };

            case 'POST':
                const newDish = JSON.parse(body);
                newDish.id = Date.now();
                dishes.push(newDish);
                localStorage.setItem('gavhar_dishes', JSON.stringify(dishes));
                return { data: newDish, success: true };

            case 'PUT':
                // Handle update logic
                return { success: true };

            case 'DELETE':
                // Handle delete logic
                return { success: true };

            default:
                return { error: 'Method not supported' };
        }
    }

    handleSettingsLocal(method, body) {
        switch (method) {
            case 'GET':
                const settings = {
                    serviceCharge: parseInt(localStorage.getItem('gavhar_service_charge') || '10'),
                    restaurantMode: localStorage.getItem('gavhar_restaurant_mode') || 'public'
                };
                return { data: settings, success: true };

            case 'PUT':
                const newSettings = JSON.parse(body);
                localStorage.setItem('gavhar_service_charge', newSettings.serviceCharge.toString());
                localStorage.setItem('gavhar_restaurant_mode', newSettings.restaurantMode);
                return { data: newSettings, success: true };

            default:
                return { error: 'Method not supported' };
        }
    }

    // Search functionality
    async searchDishes(query) {
        const dishes = await this.getDishes();
        if (!dishes.data) return { data: [], success: true };

        const filteredDishes = dishes.data.filter(dish => {
            const searchText = query.toLowerCase();
            return (
                dish.name.ru.toLowerCase().includes(searchText) ||
                dish.name.uz.toLowerCase().includes(searchText) ||
                dish.name.en.toLowerCase().includes(searchText) ||
                dish.composition.ru.toLowerCase().includes(searchText) ||
                dish.composition.uz.toLowerCase().includes(searchText) ||
                dish.composition.en.toLowerCase().includes(searchText)
            );
        });

        return { data: filteredDishes, success: true };
    }

    // Utility methods
    isAlcoholicAllowed() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.has('restaurant') || urlParams.has('admin');
    }

    getServiceChargePercent() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('restaurant')) {
            return parseInt(localStorage.getItem('gavhar_service_charge') || '10');
        }
        return 0;
    }

    // Menu data filtering
    async getFilteredMenu() {
        const [categoriesResponse, dishesResponse] = await Promise.all([
            this.getCategories(),
            this.getDishes()
        ]);

        if (!categoriesResponse.success || !dishesResponse.success) {
            throw new Error('Failed to load menu data');
        }

        const allowAlcohol = this.isAlcoholicAllowed();

        // Filter categories
        const filteredCategories = categoriesResponse.data.filter(category =>
            !category.isAlcoholic || allowAlcohol
        );

        // Filter dishes
        const filteredDishes = dishesResponse.data.filter(dish =>
            dish.inStock && (!dish.isAlcoholic || allowAlcohol)
        );

        return {
            categories: filteredCategories,
            dishes: filteredDishes,
            serviceCharge: this.getServiceChargePercent()
        };
    }
}

// Create global API instance
window.gavharAPI = new GavharAPI();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GavharAPI;
}
