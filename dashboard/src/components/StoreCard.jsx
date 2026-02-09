import { useState } from 'react';
import { StoreMetrics } from './StoreMetrics';
import { ActivityTimeline } from './ActivityTimeline';

export function StoreCard({ store, onDelete }) {
    const [showTimeline, setShowTimeline] = useState(false);

    const getStatusColor = (status) => {
        switch (status) {
            case 'ready': return 'bg-green-100 text-green-800 border-green-300';
            case 'provisioning': return 'bg-yellow-100 text-yellow-800 border-yellow-300 animate-pulse';
            case 'failed': return 'bg-red-100 text-red-800 border-red-300';
            case 'deleting': return 'bg-gray-100 text-gray-800 border-gray-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'ready': return '✅';
            case 'provisioning': return '⏳';
            case 'failed': return '❌';
            case 'deleting': return '🗑️';
            default: return '❓';
        }
    };

    return (
        <div className="store-card">
            <div className="store-header">
                <div className="store-title">
                    <h3>{store.name}</h3>
                    <span className="store-type">{store.type}</span>
                </div>
                <span className={`status-badge ${getStatusColor(store.status)}`}>
                    {getStatusIcon(store.status)} {store.status.toUpperCase()}
                </span>
            </div>

            <div className="store-details">
                {store.url ? (
                    <div className="store-url">
                        <strong>URL:</strong>
                        <a href={store.url} target="_blank" rel="noopener noreferrer">
                            {store.url}
                        </a>
                    </div>
                ) : (
                    <div className="store-url-pending">URL will be available when ready</div>
                )}

                <div className="store-meta">
                    <span>Created: {new Date(store.created_at).toLocaleString()}</span>
                    <span>Namespace: {store.namespace}</span>
                </div>

                {/* Store Metrics */}
                <StoreMetrics store={store} />

                {/* Activity Timeline Toggle */}
                <button
                    className="timeline-toggle"
                    onClick={() => setShowTimeline(!showTimeline)}
                >
                    {showTimeline ? '▼' : '▶'} Activity Timeline
                </button>

                {showTimeline && <ActivityTimeline storeId={store.id} />}
            </div>

            <div className="store-actions">
                {store.status === 'ready' && store.url && (
                    <a href={store.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                        Open Store
                    </a>
                )}
                <button
                    onClick={() => onDelete(store.id)}
                    className="btn btn-danger"
                    disabled={store.status === 'deleting'}
                >
                    {store.status === 'deleting' ? 'Deleting...' : 'Delete'}
                </button>
            </div>
        </div>
    );
}
