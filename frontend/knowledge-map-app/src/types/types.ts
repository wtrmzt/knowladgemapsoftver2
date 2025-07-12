export interface User {
  id: number;
  google_id: string;
  email: string;
  name?: string;
  created_at: string;
}

export interface Memo {
  id: number;
  user_id: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CustomNodeData {
  label?: string;
  sentence?: string;
  apiNodeId?: string | number;
  extend_query?: string[];
}

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

export interface KnowledgeMapData {
  nodes: ApiMapNode[];
  edges: ApiMapEdge[];
}

export interface KnowledgeMap { // バックエンドの /api/maps/{memo_id} や /api/memos/{memo_id}/generate_map のレスポンス型
  memo_id: number;
  map_data: KnowledgeMapData;
  generated_at?: string; // オプショナル
  message?: string; // ダミーデータ使用時など
}
