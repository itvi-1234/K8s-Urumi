import { useState } from 'react';

export function CreateStoreModal({ isOpen, onClose, onCreate }) {
    const [formData, setFormData] = useState({ name: '', type: 'woocommerce' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const result = await onCreate(formData);

        if (result.success) {
            setFormData({ name: '', type: 'woocommerce' });
            onClose();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create New Store</h2>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="name">Store Name</label>
                        <input
                            type="text"
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="my-awesome-store"
                            pattern="[a-zA-Z0-9-]+"
                            required
                            minLength={3}
                            maxLength={50}
                        />
                        <small>Only letters, numbers, and hyphens allowed</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="type">Store Type</label>
                        <select
                            id="type"
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            required
                        >
                            <option value="woocommerce">WooCommerce</option>
                            <option value="medusa">MedusaJS</option>
                        </select>
                    </div>

                    {error && <div className="error-alert">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" onClick={onClose} className="btn btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Store'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
