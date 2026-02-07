import { useState, useEffect } from 'react';
import { api } from '../services/api';

export function useStores() {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchStores = async () => {
        try {
            const result = await api.getStores();
            setStores(result.data || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStores();
        const interval = setInterval(fetchStores, 5000); // Auto-refresh every 5s
        return () => clearInterval(interval);
    }, []);

    const createStore = async (data) => {
        try {
            await api.createStore(data);
            await fetchStores();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const deleteStore = async (id) => {
        try {
            await api.deleteStore(id);
            await fetchStores();
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    return { stores, loading, error, createStore, deleteStore, refresh: fetchStores };
}
