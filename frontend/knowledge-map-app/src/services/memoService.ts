import apiClient from './apiClient';
import type { Memo,KnowledgeMap } from '../types';

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
    // ★★★ 新規追加: メモと初期マップを一度に作成する関数 ★★★
  createMemoWithMap: async (content: string): Promise<{ memo: Memo, map: KnowledgeMap }> => {
    const response = await apiClient.post<{ memo: Memo, map: KnowledgeMap }>('/memos_with_map', { content });
    return response.data;
  },
};
