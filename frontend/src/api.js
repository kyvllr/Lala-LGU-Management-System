import axios from 'axios';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').trim() || 'http://localhost:5001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const createPaymentProofRequest = (data, proofFile) => {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });
  formData.append('proofOfPayment', proofFile);
  return formData;
};

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
    const requestUrl = String(error?.config?.url || '');
    const isLoginRequest = /\/auth\/login\/?$/.test(requestUrl);

    if (error.response?.status === 401 && !isLoginRequest) {
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
  createProfileUpdateRequest: (data) => api.post('/staff-update-requests', data),
  getProfileUpdateRequests: () => api.get('/staff-update-requests'),
  reviewProfileUpdateRequest: (requestId, status) => api.patch(`/staff-update-requests/${requestId}/review`, { status }),
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
  getAwardees: () => api.get('/personal-data-sheets/awardees'),
  addAwardee: (sourcePdsId, awardType) => api.post('/personal-data-sheets/awardees', { sourcePdsId, awardType }),
  removeAwardee: (awardeeId) => api.delete(`/personal-data-sheets/awardees/${awardeeId}`),
  saveSeparationDetails: (pdsId, { separationReason, effectivityDate }) => api.put(
    `/personal-data-sheets/${pdsId}/separation-details`,
    { separationReason, effectivityDate }
  ),
  review: (pdsId, status, remarks = '') => api.patch(`/personal-data-sheets/${pdsId}/review`, { status, remarks }),
  setUpdatePermission: (pdsId, allowUpdate, durationDays) => api.patch(`/personal-data-sheets/${pdsId}/update-permission`, {
    allowUpdate,
    ...(typeof durationDays === 'number' ? { durationDays } : {}),
  }),
  setAllEmployeesUpdatePermission: (allowUpdate, durationDays) => api.patch('/personal-data-sheets/update-permission/all-employees', {
    allowUpdate,
    ...(typeof durationDays === 'number' ? { durationDays } : {}),
  }),
  delete: (pdsId) => api.delete(`/personal-data-sheets/${pdsId}`),
};

export const jobPortalAPI = {
  getAnnouncements: (status) => api.get('/announcements', { params: status ? { status } : {} }),
  createAnnouncement: (data) => api.post('/announcements', data),
  updateAnnouncementStatus: (announcementId, status) => api.patch(`/announcements/${encodeURIComponent(announcementId)}/status`, { status }),
  deleteAnnouncement: (announcementId) => api.delete(`/announcements/${encodeURIComponent(announcementId)}`),
  getPostings: (status) => api.get('/job-postings', { params: status ? { status } : {} }),
  createPosting: (data) => api.post('/job-postings', data),
  updatePostingStatus: (postingId, status) => api.patch(`/job-postings/${postingId}/status`, { status }),
  getApplications: (status) => api.get('/job-applications', { params: status ? { status } : {} }),
  reviewApplication: (pdsId, status, remarks = '') => api.patch(`/job-applications/${pdsId}/review`, { status, remarks }),
};

export const dpcrfAPI = {
  submit: (data) => api.post('/dpcrf-submissions', data),
  submitPartII: (data) => api.post('/dpcrf-submissions/part2', data),
  getMy: (year) => api.get('/dpcrf-submissions/my', { params: { year } }),
  getAll: (year) => api.get('/dpcrf-submissions', { params: { year } }),
  getPermission: (year) => api.get('/dpcrf/permission', { params: { year } }),
  setPermission: (year, allowUpdate, lockMode = 'manual', durationValue = '') => api.patch('/dpcrf/permission', {
    year,
    allowUpdate,
    lockMode,
    ...(durationValue !== '' && durationValue !== null && durationValue !== undefined ? { durationValue: Number(durationValue) } : {}),
  }),
  updatePartIIActualRates: (submissionId, ratings) => api.patch(`/dpcrf-submissions/${submissionId}/part2-ar`, { ratings }),
  getSpmsCalendar: (year) => api.get('/dpcrf/spms-calendar', { params: { year } }),
  saveSpmsCalendar: (data) => api.put('/dpcrf/spms-calendar', data),
};

export const vaultAPI = {
  getFolders: () => api.get('/vault/folders'),
  createFolder: (name) => api.post('/vault/folders', { name }),
  deleteFolder: (folderName) => api.delete(`/vault/folders/${encodeURIComponent(folderName)}`),
  getFiles: () => api.get('/vault/files'),
  uploadFiles: (files, folder) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('folder', folder);
    return api.post('/vault/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  moveFile: (fileId, folder) => api.patch(`/vault/files/${fileId}/move`, { folder }),
  deleteFile: (fileId) => api.delete(`/vault/files/${fileId}`),
  getFileContent: (fileId, mode = 'view') => api.get(`/vault/files/${fileId}/content`, {
    params: { mode },
    responseType: 'blob',
  }),
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

// COE (Certificate of Employment) API
export const coeAPI = {
  getAll: (status) => api.get('/coes', { params: { status } }),
  getByStaffId: (staffId) => api.get(`/coes/staff/${staffId}`),
  create: (data, proofFile) => api.post('/coes', createPaymentProofRequest(data, proofFile), {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getPaymentProof: (coeId) => api.get(`/payment-proofs/coe/${encodeURIComponent(coeId)}`, { responseType: 'blob' }),
  approve: (id, data) => api.patch(`/coes/${id}/approve`, data),
  disapprove: (id, data) => api.patch(`/coes/${id}/disapprove`, data),
  revise: (id, data) => api.patch(`/coes/${id}/revise`, data),
  delete: (id) => api.delete(`/coes/${id}`),
};

export const noPendencyRequestAPI = {
  getAll: (status) => api.get('/no-pendency-requests', { params: { status } }),
  getByStaffId: (staffId) => api.get(`/no-pendency-requests/staff/${staffId}`),
  create: (data, proofFile) => api.post('/no-pendency-requests', createPaymentProofRequest(data, proofFile), {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getPaymentProof: (requestId) => api.get(`/payment-proofs/no-pendency/${encodeURIComponent(requestId)}`, { responseType: 'blob' }),
  approve: (id, data) => api.patch(`/no-pendency-requests/${id}/approve`, data),
  disapprove: (id, data) => api.patch(`/no-pendency-requests/${id}/disapprove`, data),
};

export const noLeaveWithoutPayCertificateAPI = {
  getAll: (status) => api.get('/no-leave-without-pay-certificates', { params: { status } }),
  getByStaffId: (staffId) => api.get(`/no-leave-without-pay-certificates/staff/${encodeURIComponent(staffId)}`),
  create: (data, proofFile) => api.post(
    '/no-leave-without-pay-certificates',
    createPaymentProofRequest(data, proofFile),
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
  review: (id, decision, remarks = '') => api.patch(
    `/no-leave-without-pay-certificates/${encodeURIComponent(id)}/${decision}`,
    { remarks }
  ),
  getPaymentProof: (requestId) => api.get(
    `/payment-proofs/no-leave-without-pay/${encodeURIComponent(requestId)}`,
    { responseType: 'blob' }
  ),
};

export const requestTrackerAPI = {
  getMy: () => api.get('/my-requests'),
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
