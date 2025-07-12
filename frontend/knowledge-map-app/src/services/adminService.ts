// src/services/adminService.ts
import apiClient from './apiClient';

export const adminService = {
  /**
   * 全てのユーザーリストを取得する
   */
  getAllUsers: async (): Promise<{ id: number; username: string }[]> => {
    const response = await apiClient.get('/admin/users');
    return response.data;
  },

  /**
   * 特定のユーザーの全メモリストを取得する
   * @param userId ユーザーID
   */
  getUserMemos: async (userId: number): Promise<{ id: number; content: string }[]> => {
    const response = await apiClient.get(`/admin/memos/${userId}`);
    return response.data;
  },

  /**
   * 特定のメモの全マップ履歴を取得する
   * @param memoId メモID
   */
  getMapHistory: async (memoId: number): Promise<any[]> => {
    const response = await apiClient.get(`/admin/map_history/${memoId}`);
    return response.data;
  },
  // ★★★ 新規追加: システム統計情報を取得する関数 ★★★
  getSystemStats: async (): Promise<any> => {
    const response = await apiClient.get('/admin/stats');
    return response.data;
  },

  // ★★★ 新規追加: マップをロールバックする関数 ★★★
  rollbackToHistory: async (memoId: number, historyId: number): Promise<void> => {
    await apiClient.post(`/admin/rollback/${memoId}`, { history_id: historyId });
  },
  // ★★★ 新規追加: 統合マップデータを取得する関数 ★★★
  getCombinedMap: async (): Promise<any[]> => {
    const response = await apiClient.get('/admin/combined_map');
    return response.data;
  },
};
