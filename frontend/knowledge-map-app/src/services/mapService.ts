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

// ★ 変更点: 手動作成したノードのAPIレスポンスの型を定義
interface ManualNodeApiResponse {
    id: string;
    label: string;
    sentence: string;
    extend_query: string[];
}


export const mapService = {
  generateMap: async (memoId: number): Promise<ApiKnowledgeMapResponse> => {
    const response = await apiClient.post<ApiKnowledgeMapResponse>(`/memos/${memoId}/generate_map`);
    return response.data;
  },
  
  getMap: async (memoId: number): Promise<ApiKnowledgeMapResponse> => {
    const response = await apiClient.get<ApiKnowledgeMapResponse>(`/maps/${memoId}`);
    return response.data;
  },
  
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
  },

  // ★ 変更点: 手動でノードを作成するためのAPIを呼び出す関数を新しく追加
  createManualNode: async (label: string): Promise<ManualNodeApiResponse> => {
    const response = await apiClient.post<ManualNodeApiResponse>('/nodes/create_manual', { label });
    return response.data;
  }
};
