import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './ActivityTimeline.css';

export function ActivityTimeline({ storeId }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadEvents();
        // Refresh events every 10 seconds
        const interval = setInterval(loadEvents, 10000);
        return () => clearInterval(interval);
    }, [storeId]);

    async function loadEvents() {
        try {
            const response = await api.getStoreEvents(storeId, 10);
            setEvents(response.data);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // Less than 1 minute
        if (diff < 60000) return 'Just now';

        // Less than 1 hour
        if (diff < 3600000) {
            const minutes = Math.floor(diff / 60000);
            return `${minutes}m ago`;
        }

        // Less than 24 hours
        if (diff < 86400000) {
            const hours = Math.floor(diff / 3600000);
            return `${hours}h ago`;
        }

        // More than 24 hours
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    if (loading) {
        return <div className="activity-timeline loading">Loading events...</div>;
    }

    if (error) {
        return <div className="activity-timeline error">Error: {error}</div>;
    }

    if (events.length === 0) {
        return <div className="activity-timeline empty">No events yet</div>;
    }

    return (
        <div className="activity-timeline">
            <h4>Activity Timeline</h4>
            <div className="timeline-events">
                {events.map((event) => (
                    <div key={event.id} className={`timeline-event ${event.severity}`}>
                        <div className="event-content">
                            <div className="event-message">{event.message}</div>
                            <div className="event-time">{formatTime(event.created_at)}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
