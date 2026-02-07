const API_BASE = import.meta.env.VITE_API_URL || '/api';

export const api = {
    async getStores() {
        const response = await fetch(`${API_BASE}/stores`);
        if (!response.ok) throw new Error('Failed to fetch stores');
        return response.json();
    },

    async createStore(data) {
        const response = await fetch(`${API_BASE}/stores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create store');
        }
        return response.json();
    },

    async deleteStore(id) {
        const response = await fetch(`${API_BASE}/stores/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete store');
        return response.json();
    },

    async getHealth() {
        const response = await fetch(`${API_BASE}/health`);
        return response.json();
    }
};
