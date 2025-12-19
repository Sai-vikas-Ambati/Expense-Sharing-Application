import axios from 'axios';

const api = axios.create({
    baseURL: '/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authApi = {
    register: (data: { email: string; password: string; name: string }) =>
        api.post('/auth/register', data),
    login: (data: { email: string; password: string }) =>
        api.post('/auth/login', data),
    getMe: () => api.get('/auth/me'),
};

// Groups API
export const groupsApi = {
    list: () => api.get('/groups'),
    create: (data: { name: string; description?: string }) =>
        api.post('/groups', data),
    get: (id: string) => api.get(`/groups/${id}`),
    addMember: (groupId: string, email: string) =>
        api.post(`/groups/${groupId}/members`, { email }),
};

// Expenses API
export const expensesApi = {
    list: (groupId: string) => api.get(`/groups/${groupId}/expenses`),
    create: (groupId: string, data: {
        amount: number;
        description: string;
        splitType: 'EQUAL' | 'EXACT' | 'PERCENTAGE';
        participants: { userId: string; value?: number }[];
    }) => api.post(`/groups/${groupId}/expenses`, data),
    delete: (groupId: string, expenseId: string) =>
        api.delete(`/groups/${groupId}/expenses/${expenseId}`),
};

// Settlements API
export const settlementsApi = {
    getBalances: (groupId: string) => api.get(`/groups/${groupId}/balances`),
    list: (groupId: string) => api.get(`/groups/${groupId}/settlements`),
    create: (groupId: string, data: { toUserId: string; amount: number }) =>
        api.post(`/groups/${groupId}/settlements`, data),
};

export default api;
