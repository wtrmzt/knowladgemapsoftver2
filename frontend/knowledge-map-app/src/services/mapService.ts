// src/services/mapService.ts
import apiClient from './apiClient';
import type { KnowledgeMap as ApiKnowledgeMapResponse, TemporalRelatedNodesResponse, SuggestedNode } from '../types';

interface NodeInfoPayload {
  id?: string | number;
  label: string;
  sentence?: string;
  extend_query?: string[]; 
  year?: number;
}

interface SuggestRelatedNodesApiResponse {
  suggested_nodes: SuggestedNode[];
}

export const mapService = {
  // ★★★ userId引数を削除 ★★★
  generateMap: async (memoId: number): Promise<ApiKnowledgeMapResponse> => {
    const response = await apiClient.post<ApiKnowledgeMapResponse>(`/memos/${memoId}/generate_map`);
    return response.data;
  },
  
  // ★★★ userId引数を削除 ★★★
  getMap: async (memoId: number): Promise<ApiKnowledgeMapResponse> => {
    const response = await apiClient.get<ApiKnowledgeMapResponse>(`/maps/${memoId}`);
    return response.data;
  },
  
  // ★★★ 新規追加: マップの状態をサーバーに保存する関数 ★★★
  updateMap: async (memoId: number, mapData: { nodes: any[], edges: any[] }): Promise<void> => {
    await apiClient.put(`/maps/${memoId}`, mapData);
  },

  
  suggestRelatedNodes: async (nodeLabel: string): Promise<SuggestRelatedNodesApiResponse> => {
    const encodedNodeLabel = encodeURIComponent(nodeLabel);
    const response = await apiClient.get<SuggestRelatedNodesApiResponse>(`/nodes/${encodedNodeLabel}/suggest_related`);
    return response.data;
  },
  
  suggestTemporalRelatedNodes: async (nodeInfo: NodeInfoPayload): Promise<TemporalRelatedNodesResponse> => {
    const response = await apiClient.post<TemporalRelatedNodesResponse>(`/temporal_related_nodes`, { node: nodeInfo });
    return response.data;
  }
};
