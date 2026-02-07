/**
 * Sanitize error messages to remove sensitive information and technical details
 * that shouldn't be shown to end users
 * @param {string} errorMessage - Raw error message
 * @returns {string} - Sanitized, user-friendly error message
 */
export function sanitizeErrorMessage(errorMessage) {
    if (!errorMessage) return 'An unknown error occurred';

    // Remove Helm command details
    if (errorMessage.includes('helm upgrade') || errorMessage.includes('Helm install failed')) {
        return 'Store provisioning failed. Please try again or contact support.';
    }

    // Remove Helm uninstall details
    if (errorMessage.includes('helm uninstall')) {
        return 'Store deletion failed. Please try again or contact support.';
    }

    // Handle timeout errors
    if (errorMessage.includes('Timeout waiting for pods')) {
        return 'Store provisioning timed out. The store may still be starting up.';
    }

    // Handle resource quota errors
    if (errorMessage.includes('quota') || errorMessage.includes('resources')) {
        return 'Insufficient resources to create store. Please try again later.';
    }

    // Handle namespace errors
    if (errorMessage.includes('namespace')) {
        return 'Failed to create store namespace. Please try again.';
    }

    // Handle network/connection errors
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection')) {
        return 'Connection error. Please check your cluster connectivity.';
    }

    // Handle unknown store type
    if (errorMessage.includes('Unknown store type')) {
        return 'Invalid store type selected.';
    }

    // For any other errors, return a generic message
    // The full error will still be logged server-side
    return 'An error occurred during provisioning. Please try again.';
}

/**
 * Log the full error for debugging while returning a sanitized version
 * @param {string} storeName - Name of the store
 * @param {string} operation - Operation being performed (e.g., 'provision', 'deprovision')
 * @param {string} errorMessage - Raw error message
 * @returns {string} - Sanitized error message
 */
export function logAndSanitizeError(storeName, operation, errorMessage) {
    // Log full error for server-side debugging
    console.error(`❌ ${operation} error for ${storeName}:`, errorMessage);

    // Return sanitized version for database/UI
    return sanitizeErrorMessage(errorMessage);
}
