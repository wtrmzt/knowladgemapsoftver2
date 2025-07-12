export interface User {
  id: number;
  google_id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface Memo {
  id: number;
  user_id?: number;
  content: string;
  created_at: string;
  updated_at?: string;
}

// ★★★ 修正点2: 重複していたCustomNodeDataインターフェースを一つに統合 ★★★
export interface CustomNodeData {
  label?: string;
  sentence?: string;
  apiNodeId?: string | number;
  all_qids?: string[];
  extend_query?: string[]; // 古い形式との互換性のため残す
  owner?: string; // for combined map view
}

// src/types.ts
import type { Node } from 'reactflow';

/** APIから返されるメモの型 */
export interface Memo {
  id: number;
  content: string;
  created_at: string;
}

/** APIから返されるノードの型 */
export interface ApiNode {
  id: string | number;
  label: string;
  sentence?: string;
  extend_query?: string[];
  all_node_qids?: string[];
  position?: { x: number; y: number };
  type?: string;
  data?: any; // 古いデータ構造との互換性のため
}

/** APIから返されるエッジの型 */
export interface ApiEdge {
  id: string;
  source: string | number;
  target: string | number;
  from?: string | number;
  to?: string | number;
  animated?: boolean;
}

/** 知識マップのノードとエッジのデータ構造 */
export interface KnowledgeMapData {
  nodes: ApiNode[];
  edges: ApiEdge[];
}

export interface KnowledgeMapNode {
  nodes: ApiNode[];
}

/** APIから返される知識マップ全体のレスポンス型 */
export interface KnowledgeMap {
  memo_id: number;
  map_data: KnowledgeMapData;
  generated_at?: string | null; // オプショナルかつnullを許容
  message?: string; // ダミーデータ使用時など
}

/** React Flowで実際に使用するノードのデータ型 */
export interface CustomNodeData {
  label?: string ; // labelは必須ではないが、表示用に使用
  sentence?: string;
  apiNodeId?: string | number;
  all_qids?: string[];
  owner?: string; // for combined map view

}

/** APIから返される関連候補ノードの型 */
export interface SuggestedNode {
  id: string | number;
  label: string;
  sentence: string;
}

/** 時系列マップのAPIレスポンス型 */
export interface TemporalRelatedNodesResponse {
  past_map: KnowledgeMapData | null;
  future_map: KnowledgeMapData | null;
}

// React Flowで型を特定するためのエイリアス
export type CustomNodeType = Node<CustomNodeData>;

// React Flow が期待するノードとエッジの基本型
export interface RFNode {
  id: string;
  data: { label: string; [key: string]: any };
  position: { x: number; y: number };
  type?: string; // 'input', 'output', 'default' またはカスタムタイプ
  style?: React.CSSProperties;
  // 他にもReact Flowのプロパティ
}

export interface RFEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string; // 'default', 'step', 'smoothstep', 'straight' またはカスタムタイプ
  animated?: boolean;
  markerEnd?: any; // MarkerTypeなど
  style?: React.CSSProperties;
}

// APIから返されるマップデータの構造 (バックエンドのJSON形式に合わせる)
export interface ApiMapNode {
  id: string | number; // バックエンドのID形式に注意
  label: string;
  sentence?: string;
  // 他のプロパティがあれば追加
}

export interface ApiMapEdge {
  from: string | number; // バックエンドのID形式に注意
  to: string | number;   // バックエンドのID形式に注意
  // 他のプロパティがあれば追加
}
export type ApiKnowledgeMapResponse = KnowledgeMap;
