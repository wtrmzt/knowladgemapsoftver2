// src/components/admin/CombinedMapView.tsx
import { useState, useEffect, useCallback } from 'react';
// 必要なフックとコンポーネントをインポートします
import {
    ReactFlow,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    useReactFlow,
    ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css'; // スタイルのインポートは必須です
import type { Node, Edge, OnNodesChange, OnEdgesChange } from 'reactflow';
import { adminService } from '../../services/adminService';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { CustomNodeData } from '../../types';

type CustomNodeType = Node<CustomNodeData>;

// カスタムノードの定義（スタイルを改善）
const OwnerNode = ({ data }: { data: CustomNodeData & { owner: string } }) => (
    <div className="p-3 border-2 border-blue-300 rounded-lg bg-white shadow-lg text-center min-w-[120px] min-h-[80px] flex flex-col justify-center">
        <div className="text-sm font-bold text-gray-800">{data.label}</div>
        <div className="text-xs text-gray-500 mt-1 border-t pt-1">所有者: {data.owner}</div>
        {data.sentence && (
            <div className="text-xs text-gray-600 mt-1 max-w-[100px] truncate" title={data.sentence}>
                {data.sentence}
            </div>
        )}
    </div>
);
// ★ 新規追加: 所有者グループを囲む背景ノード

const nodeTypes = { ownerNode: OwnerNode };
const elk = new ELK();

// 修正版：描画とフック使用に特化した、よりシンプルな子コンポーネント
const FlowRenderer = (props: {
    nodes: CustomNodeType[];
    edges: Edge[];
    onNodesChange: OnNodesChange;
    onEdgesChange: OnEdgesChange;
}) => {
    const { fitView, getNodes, getViewport, setViewport } = useReactFlow();
    const [isInitialized, setIsInitialized] = useState(false);

    // ReactFlowの初期化を確認
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsInitialized(true);
            console.log("ReactFlow initialized");
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // ノードが更新されたら、ビューを自動調整します
    useEffect(() => {
        if (props.nodes.length > 0 && isInitialized) {
            console.log("FlowRenderer: Fitting view for nodes:", props.nodes.length);
            console.log("Current nodes positions:", props.nodes.map(n => ({ id: n.id, position: n.position })));
            console.log("Current viewport:", getViewport());
            
            // まずビューポートをリセット
            setViewport({ x: 0, y: 0, zoom: 0.8 });
            
            // より長い遅延と複数回の試行
            const timer = setTimeout(() => {
                console.log("Executing fitView...");
                
                // fitView後の状態を確認
                setTimeout(() => {
                    console.log("After fitView - viewport:", getViewport());
                    console.log("After fitView - nodes count:", getNodes().length);
                }, 200);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [props.nodes, fitView, getNodes, getViewport, setViewport, isInitialized]);

    console.log("FlowRenderer rendering - nodes:", props.nodes.length, "edges:", props.edges.length, "initialized:", isInitialized);
    
    return (
        <div className="w-full h-full" style={{ minHeight: '500px' }}>
            <ReactFlow
                nodes={props.nodes}
                edges={props.edges}
                onNodesChange={props.onNodesChange}
                onEdgesChange={props.onEdgesChange}
                nodeTypes={nodeTypes}
                attributionPosition="bottom-left"
                fitView={false} // useEffectで制御
                minZoom={0.3}
                maxZoom={1.2}
                defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
                style={{ width: '100%', height: '100%' }}
                proOptions={{ hideAttribution: true }}
            >
                <Controls />
                <Background color="#f0f0f0" gap={16} size={1} />
                <MiniMap position="top-right" />
            </ReactFlow>
        </div>
    );
};

// --- メインコンポーネント ---
function CombinedMapView() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadCombinedMap = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const combinedData = await adminService.getCombinedMap();
            if (!Array.isArray(combinedData)) {
                throw new Error('APIから返されたデータが無効な形式です。');
            }

            const allNodes: CustomNodeType[] = [];
            const allEdges: Edge[] = [];

            // 1. 全ユーザーのノードとエッジをフラットなリストとして生成
            combinedData.forEach(userMap => {
                const { username, map_data } = userMap;
                if (!map_data || !Array.isArray(map_data.nodes)) return;

                map_data.nodes.forEach((node: any) => {
                    const nodeData = node.data || node;
                    const uniqueApiId = nodeData.apiNodeId || node.id;
                    if (!uniqueApiId) return;

                    allNodes.push({
                        id: `${username}-${uniqueApiId}`,
                        type: 'ownerNode',
                        position: { x: 0, y: 0 },
                        data: {
                            label: nodeData.label || '無題ノード',
                            sentence: nodeData.sentence || '',
                            apiNodeId: uniqueApiId,
                            owner: username
                        }
                    });
                });

                if (!Array.isArray(map_data.edges)) return;
                map_data.edges.forEach((edge: any) => {
                    if (!edge.source || !edge.target) return;
                    const sourceId = `${username}-${edge.source}`;
                    const targetId = `${username}-${edge.target}`;

                    if (allNodes.some(n => n.id === sourceId) && allNodes.some(n => n.id === targetId)) {
                        allEdges.push({
                            id: `${username}-e-${edge.id || `${edge.source}-${edge.target}`}`,
                            source: sourceId,
                            target: targetId,
                            animated: true,
                            style: { stroke: '#9ca3af', strokeWidth: 1.5 }
                        });
                    }
                });
            });

            if (allNodes.length === 0) {
                setNodes([]);
                setEdges([]);
                return;
            }

            // ★ 2. 所有者ごとにグループ化するための階層構造を定義
            const owners = [...new Set(allNodes.map(n => n.data.owner))];

            const graph = {
                id: 'root',
                layoutOptions: {
                    'elk.algorithm': 'mrtree', // 階層を持つグラフに適したアルゴリズム
                    'elk.spacing.nodeNode': '120', // グループ間のスペース
                },
                children: owners.map(owner => ({
                    id: `group-${owner}`, // グループ用の親ノードID
                    layoutOptions: {
                        'elk.algorithm': 'layered', // グループ内部のレイアウトアルゴリズム
                        'elk.direction': 'RIGHT',
                        'elk.spacing.nodeNode': '80', // グループ内のノード間スペース
                        'elk.padding.top': '80', // グループ内のパディング
                        'elk.padding.left': '40',
                        'elk.padding.bottom': '40',
                        'elk.padding.right': '40',
                    },
                    // グループに所属する子ノード
                    children: allNodes
                        .filter(node => node.data.owner === owner)
                        .map(node => ({ id: node.id, width: 150, height: 80 })),
                })),
                edges: allEdges.map(edge => ({
                    id: edge.id,
                    sources: [edge.source],
                    targets: [edge.target],
                })),
            };

            // 3. ELKでレイアウトを計算
            const layoutedGraph = await elk.layout(graph);

            // ★ 4. 計算結果をReact Flowのノード形式に変換
            const finalNodes: CustomNodeType[] = [];

            layoutedGraph.children?.forEach(group => {
                // 背景となるグループノードを追加
                finalNodes.push({
                    id: group.id,
                    type: 'groupNode',
                    data: { label: `所有者: ${group.id.replace('group-', '')}` },
                    position: { x: group.x ?? 0, y: group.y ?? 0 },
                    style: { width: group.width, height: group.height, zIndex: -1 },
                    selectable: false,
                    draggable: false,
                });

                // グループに属する子ノードを追加
                group.children?.forEach(layoutNode => {
                    const originalNode = allNodes.find(n => n.id === layoutNode.id);
                    if (originalNode) {
                        finalNodes.push({
                            ...originalNode,
                            position: {
                                x: 'x' in layoutNode ? (layoutNode as any).x ?? 0 : 0,
                                y: 'y' in layoutNode ? (layoutNode as any).y ?? 0 : 0,
                            },
                            // 親ノードのIDを指定し、ドラッグ範囲を親の境界内に制限
                            parentNode: group.id,
                            extent: 'parent',
                        });
                    }
                });
            });

            setNodes(finalNodes);
            setEdges(allEdges);

        } catch (err) {
            console.error("統合マップの読み込みまたはレイアウトに失敗:", err);
            setError(err instanceof Error ? err.message : '不明なエラーが発生しました。');
        } finally {
            setIsLoading(false);
        }
    }, [setNodes, setEdges]);

    useEffect(() => {
        loadCombinedMap();
    }, [loadCombinedMap]);

    // デバッグ用の状態表示
    console.log("CombinedMapView render - nodes:", nodes.length, "edges:", edges.length, "loading:", isLoading);

    return (
        <div className="w-full h-screen flex flex-col gap-4 p-4 bg-gray-100">
             <h1 className="text-2xl font-bold text-gray-800">統合マップ</h1>
            <div className="flex-grow w-full border rounded-lg shadow-md relative bg-gray-50 min-h-[600px] h-full">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-center">
                        <div>
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                            <p>統合マップを読み込み中...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-center">
                        <div>
                            <p className="text-red-600 mb-2">エラー: {error}</p>
                            <Button onClick={loadCombinedMap} variant="outline">再試行</Button>
                        </div>
                    </div>
                ) : nodes.length === 0 ? (
                     <div className="flex items-center justify-center h-full text-center">
                        <div>
                            <p className="text-gray-600 mb-2">表示するノードがありません</p>
                            <Button onClick={loadCombinedMap} variant="outline">再読み込み</Button>
                        </div>
                    </div>
                ) : (
                    <ReactFlowProvider>
                        <FlowRenderer
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                        />
                    </ReactFlowProvider>
                )}
            </div>
             <div className="flex-shrink-0 p-4 border-t bg-white rounded-b-lg shadow-md flex items-center justify-between">
                <div className="text-sm text-gray-600">
                    ノード数: {nodes.filter(n => n.type === 'ownerNode').length} | エッジ数: {edges.length} | グループ数: {nodes.filter(n => n.type === 'groupNode').length}
                </div>
                <Button onClick={loadCombinedMap} disabled={isLoading}>
                    {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />読み込み中...</> : '再読み込み'}
                </Button>
            </div>
        </div>
    );
}

export default CombinedMapView;