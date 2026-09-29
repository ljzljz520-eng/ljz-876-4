const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export const api = {
  // auth
  login: (employee_no, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ employee_no, password }) }),
  me: () => request('/auth/me'),
  changePassword: (old_password, new_password) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ old_password, new_password }) }),
  // users
  users: (params) => request('/users?' + new URLSearchParams(params).toString()),
  departments: () => request('/users/departments'),
  createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetPassword: (id) => request(`/users/${id}/reset-password`, { method: 'POST' }),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  // quizzes
  quizzes: (params) => request('/quizzes?' + new URLSearchParams(params).toString()),
  quiz: (id) => request(`/quizzes/${id}`),
  createQuiz: (data) => request('/quizzes', { method: 'POST', body: JSON.stringify(data) }),
  updateQuiz: (id, data) => request(`/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  publishQuiz: (id) => request(`/quizzes/${id}/publish`, { method: 'POST' }),
  archiveQuiz: (id) => request(`/quizzes/${id}/archive`, { method: 'POST' }),
  deleteQuiz: (id) => request(`/quizzes/${id}`, { method: 'DELETE' }),
  quizRecords: (id) => request(`/quizzes/${id}/records`),
  // records
  startQuiz: (quiz_id) => request('/records/start', { method: 'POST', body: JSON.stringify({ quiz_id }) }),
  submitRecord: (id, answers) => request(`/records/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  signRecord: (id, signed_name) => request(`/records/${id}/sign`, { method: 'POST', body: JSON.stringify({ signed_name }) }),
  myRecords: () => request('/records/my'),
  records: (params) => request('/records?' + new URLSearchParams(params).toString()),
  record: (id) => request(`/records/${id}`),
  certificate: (id) => request(`/records/${id}/certificate`),
  exportCsv: (params) => `${API_BASE}/records/export/csv?` + new URLSearchParams(params).toString(),
  // dashboard
  dashboardStats: () => request('/dashboard/stats'),
  myStats: () => request('/dashboard/my-stats'),
};
