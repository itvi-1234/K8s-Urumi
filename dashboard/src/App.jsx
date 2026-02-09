import { useState } from 'react';
import { useStores } from './hooks/useStores';
import { StoreCard } from './components/StoreCard';
import { CreateStoreModal } from './components/CreateStoreModal';
import { PlatformMetrics } from './components/PlatformMetrics';
import './App.css';

function App() {
    const { stores, loading, error, createStore, deleteStore } = useStores();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this store? This action cannot be undone.')) {
            return;
        }
        await deleteStore(id);
    };

    return (
        <div className="app">
            <header className="app-header">
                <div className="header-content">
                    <div className="header-title">
                        <h1>Store Orchestrator</h1>
                        <p>Kubernetes-powered e-commerce provisioning platform</p>
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-large">
                        + Create New Store
                    </button>
                </div>
                <PlatformMetrics />
            </header>

            <main className="app-main">
                {loading && stores.length === 0 ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading stores...</p>
                    </div>
                ) : error ? (
                    <div className="error-state">
                        <h3>❌ Error loading stores</h3>
                        <p>{error}</p>
                    </div>
                ) : stores.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🏪</div>
                        <h2>No stores yet</h2>
                        <p>Create your first e-commerce store to get started</p>
                        <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                            Create Your First Store
                        </button>
                    </div>
                ) : (
                    <div className="stores-grid">
                        {stores.map(store => (
                            <StoreCard key={store.id} store={store} onDelete={handleDelete} />
                        ))}
                    </div>
                )}
            </main>

            <CreateStoreModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={createStore}
            />

            <footer className="app-footer">
                <p>
                    Total Stores: <strong>{stores.length}</strong> |
                    Ready: <strong>{stores.filter(s => s.status === 'ready').length}</strong> |
                    Provisioning: <strong>{stores.filter(s => s.status === 'provisioning').length}</strong>
                </p>
            </footer>
        </div>
    );
}

export default App;
