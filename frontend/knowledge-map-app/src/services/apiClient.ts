// src/services/apiClient.ts
import axios from 'axios';

console.log("apiClient.ts: Module loaded.");

// ★★★ 修正点: localStorageのキーをここで定義し、authServiceと共通化する ★★★
const AUTH_TOKEN_KEY = 'appToken';

const apiClient = axios.create({
  baseURL: 'http://127.0.0.1:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター
apiClient.interceptors.request.use(
  (config) => {
    console.log(`apiClient: Sending request to ${config.url}`);
    // ★★★ 修正点: authServiceを介さず、localStorageから直接トークンを取得 ★★★
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log("apiClient: Token attached to request.");
    } else {
      console.log("apiClient: No token found for this request.");
    }
    return config;
  },
  (error) => {
    console.error("apiClient: Request setup error.", error);
    return Promise.reject(error);
  }
);

// レスポンスインターセプター (デバッグ用に変更なし)
apiClient.interceptors.response.use(
  (response) => {
    console.log('apiClient: Received successful response:', response);
    return response;
  },
  (error) => {
    if (error.response) {
      console.error('apiClient: Error response received:', { data: error.response.data, status: error.response.status });
    } else if (error.request) {
      console.error('apiClient: No response received for request:', error.request);
    } else {
      console.error('apiClient: Error setting up request:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;
