import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { apiClient } from './apiClient';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../config/constants';
import { User, LoginResponsePayload, extractUserRole } from '../types';

export interface PreparedSso {
  startUrl: string;
  redirectUri: string;
  verifier: string;
}

export async function prepareSso(): Promise<PreparedSso> {
  if (Platform.OS !== 'web' && Constants.appOwnership === 'expo') {
    throw new Error('SSO cần bản cài đặt LCIT Meal hoặc TestFlight; không hỗ trợ Expo Go.');
  }
  const redirectUri = Platform.OS === 'web'
    ? `${window.location.origin}/sso/callback` : 'lcitmealmobile://sso/callback';
  const result = await apiClient<PreparedSso>('/auth/sso/mobile/prepare', {
    method: 'POST', body: JSON.stringify({ redirectUri }), skipAuth: true,
  });
  if (result.redirectUri !== redirectUri || !/^[\w-]{43}$/.test(result.verifier)
    || new URL(result.startUrl).protocol !== 'https:') throw new Error('Cấu hình SSO không hợp lệ.');
  return result;
}

export async function loginWithSso(prepared: PreparedSso): Promise<{ user: User; token: string } | null> {
  // Preparation happens before the tap so the web popup opens during user activation.
  const result = await WebBrowser.openAuthSessionAsync(prepared.startUrl, prepared.redirectUri);
  if (result.type !== 'success') return null;
  const returned = new URL(result.url), expected = new URL(prepared.redirectUri);
  if (returned.protocol !== expected.protocol || returned.host !== expected.host || returned.pathname !== expected.pathname
    || returned.username || returned.password || returned.hash) throw new Error('Phản hồi SSO không hợp lệ.');
  if (returned.searchParams.has('error')) {
    const code = returned.searchParams.get('error');
    if (code === 'cancelled') return null;
    throw new Error(code === 'unlinked'
      ? 'Số điện thoại SSO không khớp với tài khoản đang hoạt động trong Cơm365. Vui lòng cập nhật số điện thoại hoặc liên hệ quản trị.'
      : code === 'missing_phone' ? 'SSO chưa cung cấp số điện thoại hợp lệ.' : 'Không hoàn tất được đăng nhập SSO. Vui lòng thử lại.');
  }
  const tickets = returned.searchParams.getAll('ticket');
  if (tickets.length !== 1 || !/^[\w-]{43}$/.test(tickets[0])) throw new Error('Mã đăng nhập SSO không hợp lệ.');
  const payload = await apiClient<LoginResponsePayload>('/auth/sso/mobile/exchange', {
    method: 'POST', body: JSON.stringify({ ticket: tickets[0], verifier: prepared.verifier }), skipAuth: true,
  });
  if (!payload.accessToken || !payload.user?.id) throw new Error('Phản hồi đăng nhập SSO không hợp lệ.');
  const user = { ...payload.user, role: extractUserRole(payload.user) };
  await storage.setItem(STORAGE_KEYS.AUTH_TOKEN, payload.accessToken);
  await storage.setObject(STORAGE_KEYS.USER_DATA, user);
  return { user, token: payload.accessToken };
}
