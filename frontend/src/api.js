import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 responses (token expired/invalid)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear stored auth data and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Staff API
export const staffAPI = {
  getAll: () => api.get('/staffs'),
  getById: (id) => api.get(`/staffs/${id}`),
  create: (data) => api.post('/staffs', data),
  update: (id, data) => api.put(`/staffs/${id}`, data),
  delete: (id) => api.delete(`/staffs/${id}`),
  getPending: () => api.get('/staffs-pending'),
  approve: (id) => api.patch(`/staffs/${id}/approve`),
  disapprove: (id) => api.patch(`/staffs/${id}/disapprove`),
  debugGetAll: () => api.get('/staffs-debug'),
  updateESignPermission: (id, permission) => api.patch(`/staffs/${id}/esign-permission`, { eSignPermission: permission }),
  updateAccountStatus: (id, isActive) => api.patch(`/staffs/${id}/account-status`, { isActive }),
};

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (email, password) => api.post('/auth/login', { email, password }),
  getCurrentUser: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// System Configuration API
export const systemAPI = {
  getRolesAndDepartments: () => api.get('/system/roles-and-departments'),
};

// System Logs API
export const systemLogAPI = {
  getAll: (params = {}) => api.get('/system-logs', { params }),
  create: (data) => api.post('/system-logs', data),
};

// Personal Data Sheet API
export const personalDataSheetAPI = {
  submit: (data) => api.post('/personal-data-sheets', data),
  update: (pdsId, data) => api.put(`/personal-data-sheets/${pdsId}`, data),
  getMy: () => api.get('/personal-data-sheets/my'),
  getAll: (status) => api.get('/personal-data-sheets', { params: { status } }),
  review: (pdsId, status, remarks = '') => api.patch(`/personal-data-sheets/${pdsId}/review`, { status, remarks }),
};

// Leave API
export const leaveAPI = {
  getAll: (status) => {
    const normalizedStatus = status === 'Disapproved' ? 'Disapproved' : status;
    return api.get('/leaves', { params: { status: normalizedStatus } });
  },
  getById: (id) => api.get(`/leave/${id}`),
  getByStaffId: (staffId) => api.get(`/leaves/staff/${staffId}`),
  create: (data) => api.post('/leaves', data),
  update: (id, data) => api.put(`/leaves/${id}`, data),
  approve: (id, data) => api.patch(`/leaves/${id}/approve`, data),
  revise: (id, data) => api.patch(`/leaves/${id}/revise`, data),
  disapprove: (id, data) => api.patch(`/leaves/${id}/disapprove`, data),
  delete: (id) => api.delete(`/leaves/${id}`),
};

// Travel Order API
export const travelOrderAPI = {
  getAll: (status) => api.get('/travel-orders', { params: { status } }),
  getById: (id) => api.get(`/travel-order/${id}`),
  getByStaffId: (staffId) => api.get(`/travel-orders/staff/${staffId}`),
  create: (data) => api.post('/travel-orders', data),
  update: (id, data) => api.put(`/travel-orders/${id}`, data),
  approve: (id, data) => api.patch(`/travel-orders/${id}/approve`, data),
  revise: (id, data) => api.patch(`/travel-orders/${id}/revise`, data),
  disapprove: (id, data) => api.patch(`/travel-orders/${id}/disapprove`, data),
  complete: (id) => api.patch(`/travel-orders/${id}/complete`),
  delete: (id) => api.delete(`/travel-orders/${id}`),
};

// Overtime API
export const overtimeAPI = {
  getAll: (status) => api.get('/overtimes', { params: { status } }),
  getById: (id) => api.get(`/overtime/${id}`),
  getByStaffId: (staffId) => api.get(`/overtimes/staff/${staffId}`),
  create: (data) => api.post('/overtimes', data),
  update: (id, data) => api.put(`/overtimes/${id}`, data),
  approve: (id, data) => api.patch(`/overtimes/${id}/approve`, data),
  revise: (id, data) => api.patch(`/overtimes/${id}/revise`, data),
  disapprove: (id, data) => api.patch(`/overtimes/${id}/disapprove`, data),
  delete: (id) => api.delete(`/overtimes/${id}`),
};

// Service Record API
export const serviceRecordAPI = {
  getAll: () => api.get('/service-records'),
  getById: (id) => api.get(`/service-record/${id}`),
  getByStaffId: (staffId) => api.get(`/service-records/staff/${staffId}`),
  create: (data) => api.post('/service-records', data),
  update: (id, data) => api.put(`/service-records/${id}`, data),
  delete: (id) => api.delete(`/service-records/${id}`),
};

// Leave Record API (Periodic leave balance records)
export const leaveRecordAPI = {
  getByStaffId: (staffId) => {
    console.log('[leaveRecordAPI.getByStaffId] Requesting staffId:', staffId);
    return api.get(`/leave-records/staff/${staffId}`);
  },
  getAll: () => api.get('/leave-records'),
  create: (data) => {
    console.log('[leaveRecordAPI.create] Creating record with data:', data);
    return api.post('/leave-records', data);
  },
  importBatch: (records) => {
    // POST /leave-records/import
    return api.post('/leave-records/import', records);
  },
  update: (recordId, data) => api.put(`/leave-records/${recordId}`, data),
  delete: (recordId) => api.delete(`/leave-records/${recordId}`),
};

export default api;
