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
};
