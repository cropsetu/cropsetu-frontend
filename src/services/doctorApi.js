/**
 * Veterinary Doctor API Client
 * Public listing/detail routes use plain axios (no auth required).
 * Review submission uses the auth-intercepted instance.
 */
import axios from 'axios';
import api from './api';
import { API_BASE_URL } from '../constants/config';

// Plain axios for public endpoints — no token needed, no 401 redirect
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export async function getDoctors(params = {}) {
  const { data } = await publicApi.get('/doctors', { params });
  return data; // { success, data: [...], meta }
}

export async function getNearbyDoctors(lat, lng, params = {}) {
  const { data } = await publicApi.get('/doctors/nearby', { params: { lat, lng, ...params } });
  return data;
}

export async function getDoctorById(id) {
  const { data } = await publicApi.get(`/doctors/${id}`);
  return data.data;
}

export async function getDoctorReviews(id, params = {}) {
  const { data } = await publicApi.get(`/doctors/${id}/reviews`, { params });
  return data;
}

export async function submitDoctorReview(id, rating, comment = '') {
  const { data } = await api.post(`/doctors/${id}/review`, { rating, comment });
  return data.data;
}

export async function trackCallClick(id) {
  return publicApi.post(`/doctors/${id}/track-call`).catch(() => {});
}

export async function trackWhatsAppClick(id) {
  return publicApi.post(`/doctors/${id}/track-whatsapp`).catch(() => {});
}
