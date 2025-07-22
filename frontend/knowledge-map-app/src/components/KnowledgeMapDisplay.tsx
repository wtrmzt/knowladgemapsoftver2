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
// ★ 変更点: Connection と、新しいアイコン(Plus)をインポート
import type { Node, Edge, OnNodesChange, OnEdgesChange, NodeMouseHandler, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input"; // ★ 変更点: Inputをインポート
import { mapService } from '@/services/mapService';
import { loggingService } from '@/services/loggingService';
import { Loader2, Search, CheckCircle, History, ArrowLeft, X, CornerUpRight, Link as ExternalLink, BrainCircuit, Sparkles, Plus } from 'lucide-react';
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

// ★ 変更点: Propsのインターフェースを更新
interface KnowledgeMapDisplayProps {
  nodes: CustomNodeType[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onNodeAdded: (newNode: CustomNodeType | null, newEdge: Edge) => void;
  onApplyTemporalMap: (newNodes: CustomNodeType[], newEdges: Edge[]) => void;
  layoutTrigger?: number;
  onConnect: (connection: Connection) => void; // エッジ接続ハンドラ
  onManualNodeAdd: (label: string) => Promise<void>; // 手動ノード追加ハンドラ
}

// (PreviewPane, TemporalMapSheetContent コンポーネントは変更なしのため省略)
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
        const allApiEdges = [...(temporalMapData.past_map?.edges ?? []), ...(temporalMapData.future_map?.edges ?? [])];
        
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
                
                setPreviewNodes(finalNodes);
                setPreviewEdges(initialEdges);
                
                setTimeout(() => fitView({ padding: 0.1, duration: 250 }), 100);
            })
            .catch(error => {
                console.error('ELK Layout Error:', error);
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
const TemporalMapSheetContent: React.FC<{
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    baseNode: CustomNodeType | null;
    onApply: (nodesToApply: CustomNodeType[], edgesToApply: Edge[]) => void;
}> = ({ isOpen, onOpenChange, baseNode, onApply }) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [temporalMapData, setTemporalMapData] = useState<TemporalRelatedNodesResponse | null>(null);

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

        const pastApiNodes = temporalMapData.past_map?.nodes ?? [];
        const futureApiNodes = temporalMapData.future_map?.nodes ?? [];
        const pastNodeIds = new Set(pastApiNodes.map(n => n.id));
        const futureNodeIds = new Set(futureApiNodes.map(n => n.id));
        
        const allApiNodes = [...pastApiNodes, ...futureApiNodes];
        const uniqueNodesMap = new Map(allApiNodes.map(node => [node.id, node]));
        const apiBaseNodeId = `input_${baseNode.data.label}`;

        const nodesToApply: CustomNodeType[] = [];
        let pastNodeIndex = 0;
        let futureNodeIndex = 0;

        uniqueNodesMap.forEach((apiNode, nodeId) => {
            if (nodeId === apiBaseNodeId) return; 

            let nodeStyle = {};
            let nodePosition = { x: baseNode.position.x, y: baseNode.position.y };
            
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

        const allApiEdges = [...(temporalMapData.past_map?.edges ?? []), ...(temporalMapData.future_map?.edges ?? [])];
        const edgesToApply: Edge[] = [];

        allApiEdges.forEach((apiEdge, i) => {
            const sourceId = (apiEdge.from || apiEdge.source) === apiBaseNodeId 
                ? baseNode.id 
                : String(apiEdge.from || apiEdge.source);
            const targetId = (apiEdge.to || apiEdge.target) === apiBaseNodeId 
                ? baseNode.id 
                : String(apiEdge.to || apiEdge.target);
            
            if (sourceId === targetId) return;

            edgesToApply.push({ 
                id: `applied-${sourceId}-${targetId}-${i}`, 
                source: sourceId, 
                target: targetId, 
                animated: true,
                style: { strokeWidth: 1.5 }
            });
        });

        onApply(nodesToApply, edgesToApply);
        onOpenChange(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="w-[90vw] sm:max-w-3xl">
                <SheetHeader><SheetTitle>「{baseNode?.data.label}」の科目の関連</SheetTitle></SheetHeader>
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

// ★ 変更点: 手動でノードを追加するためのUIコンポーネント
const ManualNodeAdder: React.FC<{
  onAdd: (label: string) => Promise<void>;
}> = ({ onAdd }) => {
  const [label, setLabel] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || isLoading) return;

    setIsLoading(true);
    await onAdd(label);
    setIsLoading(false);
    setLabel('');
  };

  return (
    // ★ 変更点: フォーム全体のスタイルを調整
    <form onSubmit={handleSubmit} className="absolute top-4 left-4 z-10 flex items-center gap-2 p-2 bg-gray-900/80 backdrop-blur-sm rounded-lg border border-gray-700 shadow-lg">
      <Input 
        placeholder="新しいノード名..." 
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        // ★ 変更点: 背景色、文字色、プレースホルダー色を明示的に指定して視認性を確保
        className="w-48 bg-gray-800 text-white border-gray-600 placeholder:text-gray-400"
      />
      <Button type="submit" size="icon" disabled={!label.trim() || isLoading}>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </Button>
    </form>
  );
};



function KnowledgeMapDisplay(props: KnowledgeMapDisplayProps) {
    // ★ 変更点: propsから onConnect と onManualNodeAdd を受け取る
    const { onNodeAdded, onApplyTemporalMap, onConnect, onManualNodeAdd } = props;
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

    const nodeLabelMap = useMemo(() => {
        const map = new Map<string, CustomNodeType>();
        props.nodes.forEach(node => {
            if (typeof node.data.label === 'string') {
                map.set(node.data.label, node);
            }
        });
        return map;
    }, [props.nodes]);

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
        return new Set(
            props.nodes.map(n => n.data.label)
        );
    }, [props.nodes]); 
    
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

    const handleSuggestionClick = useCallback((suggestedNode: SuggestedNode, type: 'learned' | 'interested') => {
        if (!selectedNode) return;

        const existingNode = nodeLabelMap.get(suggestedNode.label);

        if (existingNode) {
            loggingService.logActivity('CONNECT_EXISTING_NODE', { from: selectedNode.id, to: existingNode.id });

            const newEdge: Edge = { 
                id: `e-${selectedNode.id}-to-${existingNode.id}-${Math.random()}`,
                source: selectedNode.id, 
                target: existingNode.id, 
                animated: true 
            };
            
            onNodeAdded(null, newEdge); 
            toast({ title: "接続しました", description: `既存のノード「${existingNode.data.label}」に接続しました。` });

        } else {
            loggingService.logActivity('ADD_SUGGESTED_NODE', { 
                baseNodeId: selectedNode.id, 
                addedNodeLabel: suggestedNode.label,
                type: type
            });

            const newNodeId = `user-added-${crypto.randomUUID()}`;
            
            const nodeStyle = type === 'learned'
              ? { backgroundColor: 'hsl(140, 50%, 95%)', color: 'hsl(140, 80%, 20%)', borderColor: 'hsl(140, 50%, 80%)' }
              : { backgroundColor: 'hsl(45, 100%, 95%)', color: 'hsl(45, 90%, 25%)', borderColor: 'hsl(45, 100%, 80%)' };

            const newNode: CustomNodeType = {
                id: newNodeId,
                data: { 
                    label: suggestedNode.label, 
                    sentence: suggestedNode.sentence ?? "", 
                    apiNodeId: suggestedNode.id 
                },
                position: { 
                    x: selectedNode.position.x + 200 + (Math.random() * 50 - 25), 
                    y: selectedNode.position.y + 80 + (Math.random() * 50 - 25) 
                },
                style: nodeStyle,
            };

            const newEdge: Edge = { 
                id: `e-${selectedNode.id}-to-${newNode.id}`, 
                source: selectedNode.id, 
                target: newNode.id, 
                animated: true 
            };

            onNodeAdded(newNode, newEdge);
            toast({ 
                title: "追加しました", 
                description: `ノード「${suggestedNode.label}」を${type === 'learned' ? '学習済み' : '興味あり'}として追加しました。` 
            });
        }
    }, [selectedNode, nodeLabelMap, onNodeAdded, toast]);
    
    return (
        <div className="w-full h-full rounded-md border bg-background relative">
            <ReactFlowProvider>
                {/* ★ 変更点: ManualNodeAdder コンポーネントを配置 */}
                <ManualNodeAdder onAdd={onManualNodeAdd} />
                <ReactFlow 
                  {...props} 
                  onNodeClick={onNodeClick}
                  onConnect={onConnect} // ★ 変更点: onConnect をReactFlowに渡す
                >
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
                                <Button variant="outline" onClick={handleFetchTemporalNodes}><History className="h-4 w-4 mr-2" />電通大の科目と接続</Button>
                            </SheetFooter>
                        </div>
                    )}
                    
                    {sheetViewMode === 'loadingSuggestions' && <div className="flex-grow flex justify-center items-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}

                    {sheetViewMode === 'showSuggestions' && (
                        <div className="flex-grow flex flex-col min-h-0">
                            <ScrollArea className="flex-grow my-4 -mx-6">
                                <div className="px-6">
                                {suggestedNodes.length > 0 ? (
                                    <ul className="space-y-3">
                                        {suggestedNodes.map(sNode => {
                                        const isAdded = addedNodeLabels.has(sNode.label);
                                        
                                            return (
                                                <li key={sNode.id} className={`p-3 border rounded-md transition-colors ${isAdded ? 'bg-muted/50' : 'bg-background'}`}>
                                                    <div className="flex justify-between items-center">
                                                        <h5 className="font-semibold text-sm pr-2">{sNode.label}</h5>
                                                        {isAdded && (
                                                            <div className="flex items-center text-sm text-muted-foreground">
                                                                <CheckCircle className="h-4 w-4 mr-1.5 text-green-500" />
                                                                <span>追加済</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!isAdded && (
                                                      <div className="mt-2 pt-2 border-t border-dashed flex justify-end items-center gap-2">
                                                          <Button variant="outline" size="sm" className="text-green-700 border-green-200 hover:bg-green-50 hover:text-green-800" onClick={() => handleSuggestionClick(sNode, 'learned')}>
                                                              <BrainCircuit className="h-4 w-4 mr-1.5" />
                                                              学習した
                                                          </Button>
                                                          <Button variant="outline" size="sm" className="text-amber-700 border-amber-200 hover:bg-amber-50 hover:text-amber-800" onClick={() => handleSuggestionClick(sNode, 'interested')}>
                                                              <Sparkles className="h-4 w-4 mr-1.5" />
                                                              興味ある
                                                          </Button>
                                                      </div>
                                                    )}
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
