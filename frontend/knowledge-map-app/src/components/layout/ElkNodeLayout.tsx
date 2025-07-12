// src/components/layout/ElkNodeLayout.tsx
import { useEffect, useMemo } from 'react';
import type { FC } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode, LayoutOptions } from 'elkjs/lib/elk.bundled.js';
import { useReactFlow } from 'reactflow';
import type { Node, Edge } from 'reactflow';

interface ElkNodeLayoutProps {
  nodesToLayout: Node[];
  edgesToLayout: Edge[];
  onLayouted: (layoutedNodes: Node[]) => void;
  layoutOptions?: LayoutOptions;
  layoutTrigger?: any;
  fitViewOnLayout?: boolean;
}

const elk = new ELK();
const defaultLayoutOptions: LayoutOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.spacing.nodeNode': '100',
    'elk.layered.spacing.nodeNodeBetweenLayers': '120',
};

export const ElkNodeLayout: FC<ElkNodeLayoutProps> = ({
  nodesToLayout,
  edgesToLayout,
  onLayouted,
  layoutOptions: layoutOptionsFromProps = defaultLayoutOptions,
  layoutTrigger,
  fitViewOnLayout = true,
}) => {
  const { fitView } = useReactFlow();
  const stableLayoutOptions = useMemo(() => layoutOptionsFromProps, [layoutOptionsFromProps]);

  useEffect(() => {
    // ノードが空の場合はレイアウト処理を行わない
    if (!Array.isArray(nodesToLayout) || nodesToLayout.length === 0) {
      return;
    }
    
    const elkEdges = Array.isArray(edgesToLayout) ? edgesToLayout : [];

    const graphNodes: ElkNode['children'] = nodesToLayout.map((node) => ({
      id: node.id,
      width: node.width || 180,
      height: node.height || 60,
    }));

    // --- ▼▼▼ ここが修正点 ▼▼▼ ---
    // ELKに渡すエッジの形式に変換します。
    // `sources`と`targets`は文字列の配列である必要があります。
    // 型アノテーションを削除し、TypeScriptの型推論に任せることで、
    // ELKが期待する正しい型 '{ id: string; sources: string[]; targets: string[]; }[]' が適用されます。
    const graphEdges = elkEdges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));
    // --- ▲▲▲ 修正ここまで ▲▲▲ ---

    const graph: ElkNode = { id: 'root', layoutOptions: stableLayoutOptions, children: graphNodes, edges: graphEdges };

    elk
      .layout(graph)
      .then((layoutedGraph) => {
        const layoutedNodesMap = new Map(layoutedGraph.children?.map(n => [n.id, n]));

        const newNodesWithPositions = nodesToLayout.map((node) => {
          const elkNode = layoutedNodesMap.get(node.id);
          if (elkNode?.x && elkNode?.y) {
            return { ...node, position: { x: elkNode.x, y: elkNode.y } };
          }
          return node;
        });
        
        onLayouted(newNodesWithPositions);

        if (fitViewOnLayout) {
          setTimeout(() => {
            try { fitView(); } catch (e) { console.error("Error calling fitView:", e); }
          }, 100); 
        }
      })
      .catch(console.error);

  // レイアウトトリガーが変更されたときにのみ再レイアウトを実行
  }, [layoutTrigger]); 

  // このコンポーネントはUIをレンダリングしない
  return null; 
};

export default ElkNodeLayout;