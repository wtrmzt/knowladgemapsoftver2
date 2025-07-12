// src/services/authService.ts
import apiClient from './apiClient';
// ★★★ ライブラリをインポート ★★★
import { jwtDecode } from 'jwt-decode';

const AUTH_TOKEN_KEY = 'appToken';

interface LoginResponse {
  token: string;
  is_admin: boolean;
}
// トークンに含まれるデータの型を定義
interface DecodedToken {
  user_id: number;
  is_admin: boolean;
}

export const authService = {
  login: async (username: string): Promise<string> => {
    const response = await apiClient.post<LoginResponse>('/login', { username });
    const token = response.data.token;
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    return token;
  },

  logout: (): void => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },

  getCurrentToken: (): string | null => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  },
    // ★★★ 管理者かどうかを判定する関数を追加 ★★★
  isAdmin: (): boolean => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return false;
    try {
      const decoded: DecodedToken = jwtDecode(token);
      return decoded.is_admin || false;
    } catch (error) {
      return false;
    }
  },
  // ★★★ 新規追加: トークンからユーザーIDを取得する関数 ★★★
  /**
   * 現在のJWTをデコードし、ユーザーIDを文字列として返す。
   * @returns ユーザーIDの文字列。トークンがない、または不正な場合はnull。
   */
  getUserIdFromToken: (): string | null => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      return null;
    }
    try {
      const decoded: DecodedToken = jwtDecode(token);
      // Reactのkeyとして使うために文字列に変換
      return String(decoded.user_id);
    } catch (error) {
      console.error("Failed to decode token:", error);
      return null;
    }
  },
};
