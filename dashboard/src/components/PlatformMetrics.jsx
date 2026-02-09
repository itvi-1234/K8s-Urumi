import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './PlatformMetrics.css';

export function PlatformMetrics() {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadMetrics();
        // Refresh every 30 seconds
        const interval = setInterval(loadMetrics, 30000);
        return () => clearInterval(interval);
    }, []);

    async function loadMetrics() {
        try {
            const response = await api.getMetrics();
            setMetrics(response.data);
        } catch (err) {
            console.error('Failed to load metrics:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading || !metrics) {
        return null;
    }

    return (
        <div className="platform-metrics">
            <div className="metric-card">
                <div className="metric-value">{metrics.total_stores}</div>
                <div className="metric-label">Total Stores</div>
            </div>

            <div className="metric-card">
                <div className="metric-value">{metrics.stores_by_status?.ready || 0}</div>
                <div className="metric-label">Ready</div>
            </div>

            <div className="metric-card">
                <div className="metric-value">{metrics.success_rate_24h}%</div>
                <div className="metric-label">Success Rate (24h)</div>
            </div>

            <div className="metric-card">
                <div className="metric-value">
                    {Math.round(metrics.avg_provision_time_seconds)}s
                </div>
                <div className="metric-label">Avg Provision Time</div>
            </div>
        </div>
    );
}
