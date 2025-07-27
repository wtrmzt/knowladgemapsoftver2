import apiClient from './apiClient';
import type { Memo } from '../types';

export const memoService = {
  createMemo: async (content: string): Promise<Memo> => {
    const response = await apiClient.post<Memo>('/memos', { content });
    return response.data;
  },
  getMemos: async (): Promise<Memo[]> => {
    const response = await apiClient.get<Memo[]>('/memos');
    return response.data;
  },
  // getMemoById: async (id: number): Promise<Memo> => { ... }
  // ★★★ 修正版: エラーハンドリングを改善 ★★★
  createMemoWithMap: async (content: string): Promise<{ memo: Memo; map: { memo_id: number; map_data: any; generated_at: string } }> => {
    try {
      const response = await apiClient.post('/memos_with_map', { content });
      return response.data;
    } catch (error: any) {
      console.error('memoService.createMemoWithMap error:', error);
      
      // より詳細なエラー情報を提供
      if (error.response?.data?.message) {
        throw new Error(`サーバーエラー: ${error.response.data.message}`);
      } else if (error.response?.status) {
        throw new Error(`HTTP ${error.response.status}: リクエストに失敗しました`);
      } else if (error.message) {
        throw new Error(`ネットワークエラー: ${error.message}`);
      } else {
        throw new Error('メモとマップの作成中に不明なエラーが発生しました');
      }
    }
  },
};
