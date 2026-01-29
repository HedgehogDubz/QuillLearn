// API base URL - uses environment variable in production, empty string for local dev (proxy handles it)
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper function to make API calls
export const apiUrl = (path: string): string => {
    return `${API_BASE_URL}${path}`;
};

// Get auth headers for API calls
export const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

// Helper function for authenticated fetch calls
export const authFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const token = localStorage.getItem('token');
    const headers = new Headers(options.headers);

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
    }

    return fetch(url, {
        ...options,
        headers,
        credentials: 'include'
    });
};

