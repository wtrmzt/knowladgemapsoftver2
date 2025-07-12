// src/components/KnowledgeMapDisplay.tsx
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow';
import type { Node, Edge, OnNodesChange, OnEdgesChange, NodeMouseHandler } from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { mapService } from '@/services/mapService';
import { loggingService } from '@/services/loggingService';
import { Loader2, Search, PlusCircle, CheckCircle, History, ArrowLeft, X, CornerUpRight, Link as ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet";
import type { CustomNodeData, SuggestedNode, TemporalRelatedNodesResponse } from '../types';
import ELK from 'elkjs/lib/elk.bundled.js';

type CustomNodeType = Node<CustomNodeData>;

interface KnowledgeMapDisplayProps {
  nodes: CustomNodeType[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeAdded: (newNode: CustomNodeType | null, newEdge: Edge) => void;
  onApplyTemporalMap: (newNodes: CustomNodeType[], newEdges: Edge[]) => void;
  setNodesForLayout?: (nodes: CustomNodeType[]) => void;
  layoutTrigger?: number;
}

/**
 * プレビューパネル用のReactFlowインスタンス
 */
const PreviewPane: React.FC<{
    temporalMapData: TemporalRelatedNodesResponse | null;
    baseNode: CustomNodeType | null;
}> = ({ temporalMapData, baseNode }) => {
    const [previewNodes, setPreviewNodes, onPreviewNodesChange] = useNodesState([]);
    const [previewEdges, setPreviewEdges, onPreviewEdgesChange] = useEdgesState([]);
    const { fitView } = useReactFlow();

    useEffect(() => {
        if (!temporalMapData || !baseNode) {
            setPreviewNodes([]);
            setPreviewEdges([]);
            return;
        }

        const elk = new ELK();
        const elkLayoutOptions = {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.spacing.nodeNode': '80',
            'elk.layered.spacing.nodeNodeBetweenLayers': '100',
        };

        const apiBaseNodeId = `input_${baseNode.data.label}`;
        const allApiNodes = [...(temporalMapData.past_map?.nodes ?? []), ...(temporalMapData.future_map?.nodes ?? [])];
        
        // 基準ノードも含めて重複を排除
        const uniqueNodesMap = new Map(allApiNodes.map(node => [String(node.id), node]));
        if (!uniqueNodesMap.has(apiBaseNodeId)) {
            uniqueNodesMap.set(apiBaseNodeId, { 
                id: apiBaseNodeId, 
                label: `[基準] ${baseNode.data.label}`, 
                sentence: baseNode.data.sentence 
            });
        }

        const initialNodes: CustomNodeType[] = Array.from(uniqueNodesMap.values()).map(apiNode => ({
            id: String(apiNode.id),
            data: { 
                label: apiNode.label, 
                sentence: apiNode.sentence ?? "",
                apiNodeId: apiNode.id,
            },
            type: 'default',
            position: { x: 0, y: 0 },
            width: 150, 
            height: 50,
            style: String(apiNode.id) === apiBaseNodeId ? { 
                backgroundColor: 'hsl(var(--primary))', 
                color: 'hsl(var(--primary-foreground))' 
            } : {},
        }));
        
        const nodeIds = new Set(initialNodes.map(n => n.id));

        // ★★★ 修正1: エッジの処理を修正 ★★★
        const allApiEdges = [...(temporalMapData.past_map?.edges ?? []), ...(temporalMapData.future_map?.edges ?? [])];
        
        // APIエッジのfrom/toフィールドをsource/targetに統一
        const initialEdges: Edge[] = allApiEdges
            .filter(apiEdge => {
                const sourceId = String(apiEdge.from || apiEdge.source);
                const targetId = String(apiEdge.to || apiEdge.target);
                return nodeIds.has(sourceId) && nodeIds.has(targetId);
            })
            .map((apiEdge, i) => ({
                id: `preview-edge-${apiEdge.from || apiEdge.source}-${apiEdge.to || apiEdge.target}-${i}`,
                source: String(apiEdge.from || apiEdge.source),
                target: String(apiEdge.to || apiEdge.target),
                animated: true,
                style: { stroke: '#999', strokeWidth: 2 },
            }));
        
        // ★★★ 修正2: ELKのエッジ定義を修正 ★★★
        const graph = {
            id: 'root',
            layoutOptions: elkLayoutOptions,
            children: initialNodes.map(node => ({ 
                id: node.id, 
                width: node.width ?? 150, 
                height: node.height ?? 50 
            })),
            edges: initialEdges.map(edge => ({ 
                id: edge.id, 
                sources: [edge.source], 
                targets: [edge.target] 
            }))
        };

        elk.layout(graph)
            .then(layoutedGraph => {
                const layoutedNodesMap = new Map(layoutedGraph.children?.map(n => [n.id, n]));
                const finalNodes = initialNodes.map(node => ({ 
                    ...node, 
                    position: { 
                        x: layoutedNodesMap.get(node.id)?.x ?? 0, 
                        y: layoutedNodesMap.get(node.id)?.y ?? 0 
                    } 
                }));
                
                // ★★★ 修正3: ノードとエッジを同時に設定 ★★★
                setPreviewNodes(finalNodes);
                setPreviewEdges(initialEdges);
                
                // レイアウト後にフィットビューを実行
                setTimeout(() => fitView({ padding: 0.1, duration: 250 }), 100);
            })
            .catch(error => {
                console.error('ELK Layout Error:', error);
                // エラーが発生した場合もノードとエッジを設定
                setPreviewNodes(initialNodes);
                setPreviewEdges(initialEdges);
            });

    }, [temporalMapData, baseNode, fitView, setPreviewNodes, setPreviewEdges]);
    
    return (
        <ReactFlow 
            nodes={previewNodes} 
            edges={previewEdges} 
            onNodesChange={onPreviewNodesChange} 
            onEdgesChange={onPreviewEdgesChange} 
            fitView
            // ★★★ 修正4: ReactFlowの設定を追加 ★★★
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnScroll={true}
            panOnScroll={false}
        >
            <Background />
            <Controls />
        </ReactFlow>
    );
};

// --- TemporalMapSheetContent コンポーネント (ロジック分離版) ---
const TemporalMapSheetContent: React.FC<{
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    baseNode: CustomNodeType | null;
    onApply: (nodesToApply: CustomNodeType[], edgesToApply: Edge[]) => void;
}> = ({ isOpen, onOpenChange, baseNode, onApply }) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [temporalMapData, setTemporalMapData] = useState<TemporalRelatedNodesResponse | null>(null);

    // API呼び出しを行うuseEffect
    useEffect(() => {
        if (isOpen && baseNode) {
            if (!baseNode.data.label) {
                toast({ title: "エラー", description: "ラベルのないノードの時系列情報は取得できません。", variant: "destructive" });
                onOpenChange(false);
                return;
            }

            setIsLoading(true);
            setTemporalMapData(null);
            
            const payload = {
                id: baseNode.id,
                label: baseNode.data.label,
                sentence: baseNode.data.sentence || '',
                extend_query: baseNode.data.all_qids || [],
            };

            mapService.suggestTemporalRelatedNodes(payload)
                .then(data => setTemporalMapData(data))
                .catch(err => {
                    console.error("API Error:", err);
                    toast({ title: "APIエラー", description: `時系列情報の取得に失敗しました。詳細はコンソールを確認してください。`, variant: "destructive" });
                })
                .finally(() => setIsLoading(false));
        }
    }, [isOpen, baseNode, toast, onOpenChange]);
    
    const handleApply = () => {
        if (!temporalMapData || !baseNode) return;

        // 1. 過去/未来のノードを分類するための準備
        const pastApiNodes = temporalMapData.past_map?.nodes ?? [];
        const futureApiNodes = temporalMapData.future_map?.nodes ?? [];
        const pastNodeIds = new Set(pastApiNodes.map(n => n.id));
        const futureNodeIds = new Set(futureApiNodes.map(n => n.id));
        
        const allApiNodes = [...pastApiNodes, ...futureApiNodes];
        const uniqueNodesMap = new Map(allApiNodes.map(node => [node.id, node]));
        const apiBaseNodeId = `input_${baseNode.data.label}`;

        // 2. メインマップに追加するノードを生成 (配置とスタイルを適用)
        const nodesToApply: CustomNodeType[] = [];
        let pastNodeIndex = 0;
        let futureNodeIndex = 0;

        uniqueNodesMap.forEach((apiNode, nodeId) => {
            if (nodeId === apiBaseNodeId) return; // API側の基準ノードは追加しない

            let nodeStyle = {};
            let nodePosition = { x: baseNode.position.x, y: baseNode.position.y };
            
            // 過去か未来かでスタイルと配置を決定
            if (pastNodeIds.has(nodeId)) {
                nodeStyle = { backgroundColor: 'hsl(0 100% 95%)', color: 'hsl(0 70% 40%)', borderColor: 'hsl(0 80% 80%)' };
                nodePosition = {
                    x: baseNode.position.x - 300,
                    y: baseNode.position.y - 40 + (pastNodeIndex * 70),
                };
                pastNodeIndex++;
            } else if (futureNodeIds.has(nodeId)) {
                nodeStyle = { backgroundColor: 'hsl(210 100% 95%)', color: 'hsl(210 70% 40%)', borderColor: 'hsl(210 80% 80%)' };
                nodePosition = {
                    x: baseNode.position.x + 300,
                    y: baseNode.position.y - 40 + (futureNodeIndex * 70),
                };
                futureNodeIndex++;
            }

            nodesToApply.push({
                id: String(nodeId),
                data: { 
                    label: apiNode.label, 
                    sentence: apiNode.sentence ?? "",
                    apiNodeId: apiNode.id,
                    all_qids: apiNode.extend_query || apiNode.all_node_qids || []
                },
                type: 'default',
                position: nodePosition,
                style: nodeStyle
            });
        });

        // 3. メインマップに追加するエッジを生成
        const allApiEdges = [...(temporalMapData.past_map?.edges ?? []), ...(temporalMapData.future_map?.edges ?? [])];
        const edgesToApply: Edge[] = [];

        allApiEdges.forEach((apiEdge, i) => {
            // ★★★ 修正5: エッジのフィールド名を統一 ★★★
            const sourceId = (apiEdge.from || apiEdge.source) === apiBaseNodeId 
                ? baseNode.id 
                : String(apiEdge.from || apiEdge.source);
            const targetId = (apiEdge.to || apiEdge.target) === apiBaseNodeId 
                ? baseNode.id 
                : String(apiEdge.to || apiEdge.target);
            
            if (sourceId === targetId) return; // 自己参照ループは追加しない

            edgesToApply.push({ 
                id: `applied-${sourceId}-${targetId}-${i}`, 
                source: sourceId, 
                target: targetId, 
                animated: true,
                style: { strokeWidth: 1.5 }
            });
        });

        // 4. 親コンポーネントの関数を呼び出して状態を更新
        onApply(nodesToApply, edgesToApply);
        onOpenChange(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-[90vw] sm:max-w-3xl">
                <SheetHeader><SheetTitle>「{baseNode?.data.label}」の時系列的把握</SheetTitle></SheetHeader>
                <div className="h-[calc(100vh-160px)] my-4 border rounded-md">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    ) : (
                        <ReactFlowProvider>
                            <PreviewPane temporalMapData={temporalMapData} baseNode={baseNode} />
                        </ReactFlowProvider>
                    )}
                </div>
                <SheetFooter>
                    <SheetClose asChild><Button variant="outline">閉じる</Button></SheetClose>
                    <Button onClick={handleApply} disabled={isLoading || !temporalMapData}>
                        <CornerUpRight className="mr-2 h-4 w-4" />
                        メインのマップに反映
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};


function KnowledgeMapDisplay(props: KnowledgeMapDisplayProps) {
    const { nodes, onNodeAdded, onApplyTemporalMap } = props;
    const { toast } = useToast();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState<CustomNodeType | null>(null);
    const [sheetViewMode, setSheetViewMode] = useState<'nodeDetail' | 'loadingSuggestions' | 'showSuggestions'>('nodeDetail');
    const [suggestedNodes, setSuggestedNodes] = useState<SuggestedNode[]>([]);
    const [isTemporalSheetOpen, setIsTemporalSheetOpen] = useState(false);

    const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
        loggingService.logActivity('CLICK_NODE', { nodeId: node.id, nodeLabel: (node.data as CustomNodeData).label });
        setSelectedNode(node as CustomNodeType);
        setSheetViewMode('nodeDetail');
        setIsSheetOpen(true);
    }, []);

    // ★★★ 修正点1: ラベルをキーとして、マップ上の既存ノードを高速に検索できるようにする ★★★
    const nodeLabelMap = useMemo(() => {
        const map = new Map<string, CustomNodeType>();
        nodes.forEach(node => {
            if (typeof node.data.label === 'string') {
                map.set(node.data.label, node);
            }
        });
        return map;
    }, [nodes]);

    const handleFetchSuggestions = useCallback(async () => {
        if (!selectedNode?.data.label) return;
        loggingService.logActivity('FETCH_SUGGESTIONS', { nodeId: selectedNode.id, nodeLabel: selectedNode.data.label });
        setSheetViewMode('loadingSuggestions');
        try {
            const response = await mapService.suggestRelatedNodes(selectedNode.data.label);
            setSuggestedNodes(response?.suggested_nodes || []);
        } catch (error: any) {
            toast({ title: "エラー", description: `関連情報の取得に失敗: ${error.message}`, variant: "destructive" });
        } finally {
            setSheetViewMode('showSuggestions');
        }
    }, [selectedNode, toast]);

    const addedNodeLabels = useMemo(() => {
        // 現在マップ上にあるすべてのノードの「ラベル」をSetに集める
        return new Set(
            nodes.map(n => n.data.label)
        );
    }, [nodes]); // props.nodesが変更されるたびに再計算
    
    const handleSheetOpenChange = useCallback((open: boolean) => {
        setIsSheetOpen(open);
        if (!open) setSelectedNode(null);
    }, []);

    const handleFetchTemporalNodes = useCallback(() => {
        if (!selectedNode) return;
        loggingService.logActivity('FETCH_TEMPORAL_MAP', { nodeId: selectedNode.id, nodeLabel: selectedNode.data.label });
        setIsTemporalSheetOpen(true);
        setIsSheetOpen(false);
    }, [selectedNode]);

    // ★★★ 修正点2: ノードの追加とエッジの接続を両方扱えるようにロジックを更新 ★★★
    const handleSuggestionClick = useCallback((suggestedNode: SuggestedNode) => {
        if (!selectedNode) return;

        const existingNode = nodeLabelMap.get(suggestedNode.label);

        if (existingNode) {
            // --- ケースA: ノードが既に存在する場合 → エッジだけを追加 ---
            loggingService.logActivity('CONNECT_EXISTING_NODE', { from: selectedNode.id, to: existingNode.id });

            const newEdge: Edge = { 
                id: `e-${selectedNode.id}-to-${existingNode.id}`, 
                source: selectedNode.id, 
                target: existingNode.id, 
                animated: true 
            };
            
            
            // newNodeにnullを渡すことで、エッジのみを追加するよう親コンポーネントに伝える
            onNodeAdded(null, newEdge); 
            toast({ title: "成功", description: `ノード「${existingNode.data.label}」に接続しました。` });

        } else {
            // --- ケースB: ノードが存在しない場合 → 新しいノードとエッジを追加 ---
            loggingService.logActivity('ADD_SUGGESTED_NODE', { baseNodeId: selectedNode.id, addedNodeLabel: suggestedNode.label });

            // IDの重複を完全に防ぐため、ランダムなIDを生成
            const newNodeId = `user-added-${crypto.randomUUID()}`;
            const newNode: CustomNodeType = {
                id: newNodeId,
                data: { 
                    label: suggestedNode.label, 
                    sentence: suggestedNode.sentence ?? "", 
                    apiNodeId: suggestedNode.id 
                },
                position: { 
                    x: selectedNode.position.x + 150 + (Math.random() * 40 - 20), 
                    y: selectedNode.position.y + 60 + (Math.random() * 40 - 20) 
                },
                style: { background: 'hsl(var(--secondary))', color: 'hsl(var(--secondary-foreground))' },
            };

            const newEdge: Edge = { 
                id: `e-${selectedNode.id}-to-${newNode.id}`, 
                source: selectedNode.id, 
                target: newNode.id, 
                animated: true 
            };

            onNodeAdded(newNode, newEdge);
            toast({ title: "成功", description: `ノード「${suggestedNode.label}」を追加しました。` });
        }
    }, [selectedNode, nodeLabelMap, onNodeAdded, toast]);
    
    return (
        <div className="w-full h-full rounded-md border bg-background relative">
            <ReactFlowProvider>
                <ReactFlow {...props} onNodeClick={onNodeClick}>
                    <MiniMap /><Controls /><Background />
                </ReactFlow>
            </ReactFlowProvider>

            <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange} modal={false}>
                <SheetContent className="sm:max-w-md w-[90vw] md:w-[400px] z-[100] flex flex-col">
                    <SheetHeader>
                        <SheetTitle>
                            {sheetViewMode === 'nodeDetail' && 'ノード情報'}
                            {sheetViewMode !== 'nodeDetail' && `「${selectedNode?.data?.label}」の関連情報`}
                        </SheetTitle>
                        <SheetClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </SheetClose>
                    </SheetHeader>
                            {/* ★★★ Google検索リンクボタンを追加 ★★★ */}
                            <Button variant="outline" className="w-full" asChild>
                                <a href={`https://www.google.com/search?q=${encodeURIComponent(selectedNode?.data?.label ?? "")}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Googleで「{selectedNode?.data?.label}」を検索
                                </a>
                            </Button>
                            
                    {sheetViewMode === 'nodeDetail' && selectedNode && (
                        <div className="flex-grow flex flex-col justify-between">
                            <div className="py-4">
                                <h3 className="font-semibold text-lg">{selectedNode.data.label}</h3>
                                <p className="text-sm text-muted-foreground mt-2">{selectedNode.data.sentence}</p>
                            </div>
                            <SheetFooter className="flex-col sm:flex-col sm:space-x-0 space-y-2">
                                <Button variant="outline" onClick={handleFetchSuggestions}><Search className="h-4 w-4 mr-2" />関連情報を検索</Button>
                                <Button variant="outline" onClick={handleFetchTemporalNodes}><History className="h-4 w-4 mr-2" />時系列的把握</Button>
                            </SheetFooter>
                        </div>
                    )}
                    
                    {sheetViewMode === 'loadingSuggestions' && <div className="flex-grow flex justify-center items-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}

                    {sheetViewMode === 'showSuggestions' && (
                        <div className="flex-grow flex flex-col min-h-0">
                            <ScrollArea className="flex-grow my-4 -mx-6">
                                <div className="px-6">
                                {suggestedNodes.length > 0 ? (
                                    <ul className="space-y-2">
                                        {suggestedNodes.map(sNode => {
                                        const isAdded = addedNodeLabels.has(sNode.label);
                                        
                                            return (
                                                <li key={sNode.id} className={`p-3 border rounded-md flex justify-between items-center ${isAdded ? 'bg-muted/50' : ''}`}>
                                                    <h5 className="font-semibold text-sm">{sNode.label}</h5>
                                                    <Button variant="outline" size="sm" disabled={isAdded} onClick={() => handleSuggestionClick(sNode)}>
                                                        {isAdded ? <CheckCircle className="h-3 w-3 mr-1.5" /> : <PlusCircle className="h-3 w-3 mr-1.5" />}
                                                        {isAdded ? '追加済' : '追加'}
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : <p className="text-sm text-center text-muted-foreground py-10">関連候補は見つかりませんでした。</p>}
                                </div>
                            </ScrollArea>
                            <SheetFooter className="pt-4 border-t"><Button variant="outline" onClick={() => setSheetViewMode('nodeDetail')} className="w-full"><ArrowLeft className="h-4 w-4 mr-2" />詳細に戻る</Button></SheetFooter>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            <TemporalMapSheetContent isOpen={isTemporalSheetOpen} onOpenChange={setIsTemporalSheetOpen} baseNode={selectedNode} onApply={onApplyTemporalMap} />
        </div>
    );
}

export default KnowledgeMapDisplay;