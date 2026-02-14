import axios from 'axios';

const api = axios.create({
  baseURL: '',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const humanToken = localStorage.getItem('humanToken');
  const agentToken = localStorage.getItem('agentToken');
  const token = humanToken || agentToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
