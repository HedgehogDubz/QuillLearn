// API base URL - uses environment variable in production, empty string for local dev (proxy handles it)
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper function to make API calls
export const apiUrl = (path: string): string => {
    return `${API_BASE_URL}${path}`;
};

