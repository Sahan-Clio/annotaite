import axios from 'axios';

const baseURL = import.meta.env.APP_API_URL || 'http://localhost:3002';

export const api = axios.create({
  baseURL: `${baseURL}`,
  headers: { 'Content-Type': 'application/json' }
}); 