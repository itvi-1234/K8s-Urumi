import './StoreMetrics.css';

export function StoreMetrics({ store }) {
    function getProvisioningTime() {
        if (store.status !== 'ready' || !store.created_at || !store.updated_at) {
            return null;
        }

        const created = new Date(store.created_at);
        const updated = new Date(store.updated_at);
        const diffSeconds = Math.floor((updated - created) / 1000);

        if (diffSeconds < 60) return `${diffSeconds}s`;
        if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ${diffSeconds % 60}s`;
        return `${Math.floor(diffSeconds / 3600)}h ${Math.floor((diffSeconds % 3600) / 60)}m`;
    }

    function getUptime() {
        if (store.status !== 'ready' || !store.updated_at) {
            return null;
        }

        const updated = new Date(store.updated_at);
        const now = new Date();
        const diffMs = now - updated;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d`;
        if (diffHours > 0) return `${diffHours}h`;
        return '< 1h';
    }

    const provisionTime = getProvisioningTime();
    const uptime = getUptime();

    return (
        <div className="store-metrics">
            <div className="metric2">
                <span className="metric-label2">Type</span>
                <span className="metric-value2">{store.type.charAt(0).toUpperCase() + store.type.slice(1)}</span>
            </div>

            {provisionTime && (
                <div className="metric2">
                    <span className="metric-label2">Provision Time</span>
                    <span className="metric-value2">{provisionTime}</span>
                </div>
            )}

            {uptime && (
                <div className="metric2">
                    <span className="metric-label2">Uptime</span>
                    <span className="metric-value2">{uptime}</span>
                </div>
            )}

            {store.error_message && (
                <div className="metric error-metric">
                    <span className="metric-label2">Error</span>
                    <span className="metric-value error-message">
                        {store.error_message}
                    </span>
                </div>
            )}
        </div>
    );
}
