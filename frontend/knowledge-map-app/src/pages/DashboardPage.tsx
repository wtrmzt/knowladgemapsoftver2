// src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
// ★ 変更点: addEdge と Connection を reactflow からインポート
import { useNodesState, useEdgesState, addEdge, Connection } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import KnowledgeMapDisplay from '../components/KnowledgeMapDisplay';
import MemoInput from '../components/MemoInput';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { memoService } from '../services/memoService';
import { mapService } from '../services/mapService';
import type { Memo, CustomNodeData, KnowledgeMap, ApiKnowledgeMapResponse } from '../types';
import { Cog, Award, History, FileText, X, Brain } from 'lucide-react';

import { loggingService } from '../services/loggingService';

type CustomNodeType = Node<CustomNodeData>;

function DashboardPage() {
  const { toast } = useToast();

  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [currentMemo, setCurrentMemo] = useState<Memo | null>(null);
  const [mapDataFromApi] = useState<ApiKnowledgeMapResponse | null>(null);

  const [isMemoPanelOpen, setIsMemoPanelOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [layoutTrigger, setLayoutTrigger] = useState(0);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ★ 変更点: onConnect ハンドラを追加
  // この関数は、ユーザーがUI上でノードを接続したときにReact Flowによって呼び出される。
  const onConnect = useCallback(
    (params: Connection) => {
      loggingService.logActivity('CONNECT_NODES', { source: params.source, target: params.target });
      // addEdgeヘルパー関数を使って、新しいエッジを既存のエッジリストに追加する
      setEdges((eds) => addEdge({ ...params, animated: true, style: { strokeWidth: 2 } }, eds));
      toast({ title: "エッジを追加しました", description: `ノードを接続しました。` });
    },
    [setEdges, toast]
  );
  
  // ★ 変更点: 手動でノードを追加するためのハンドラを追加
  const handleManualNodeAdd = useCallback(async (label: string) => {
    if (!label.trim()) {
      toast({ title: "入力エラー", description: "ノード名が空です。", variant: "destructive" });
      return;
    }
    if (!currentMemo) {
      toast({ title: "エラー", description: "ノードを追加するマップがありません。まずメモを作成してください。", variant: "destructive" });
      return;
    }
    loggingService.logActivity('MANUAL_ADD_NODE_START', { label });
    try {
      // バックエンドAPIを呼び出して、AIにノード情報を生成させる
      const apiNode = await mapService.createManualNode(label);
      
      // APIから返されたデータを使って、React Flowで表示するための新しいノードオブジェクトを作成
      const newNode: CustomNodeType = {
        id: apiNode.id,
        // 新しいノードが他のノードと重ならないように、ランダムな位置に配置
        position: { x: Math.random() * 400 - 200, y: Math.random() * 400 - 200 },
        type: 'default', // デフォルトのノードタイプを使用
        data: {
            label: apiNode.label,
            sentence: apiNode.sentence,
            apiNodeId: apiNode.id,
            all_qids: apiNode.extend_query || [],
        },
        // 新しく追加されたことがわかるようにスタイルを適用
        style: { 
            backgroundColor: 'hsl(var(--muted))', 
            borderColor: 'hsl(var(--primary))' 
        },
      };

      // 作成したノードを既存のノードリストに追加して、画面を更新
      setNodes((nds) => [...nds, newNode]);
      toast({ title: "成功", description: `ノード「${label}」を追加しました。` });
      loggingService.logActivity('MANUAL_ADD_NODE_SUCCESS', { nodeId: newNode.id, label: newNode.data.label });

    } catch (error: any) {
      toast({ title: "ノード追加エラー", description: error.message, variant: "destructive" });
      loggingService.logActivity('MANUAL_ADD_NODE_FAILURE', { label, error: error.message });
    }
  }, [setNodes, toast, currentMemo]);

  // (既存の useEffect, useCallback は変更なしのため省略)
  useEffect(() => {
    const apiMapData = mapDataFromApi?.map_data;
    if (!apiMapData || !Array.isArray(apiMapData.nodes)) {
      setNodes([]);
      setEdges([]);
      return;
    }
    const transformedNodes: CustomNodeType[] = apiMapData.nodes.map((node:any) => ({
        id: String(node.id),
        position: { x: Math.random() * 400, y: Math.random() * 400 },
        type: 'default',
        data: {
            label: node.label,
            sentence: node.sentence || "詳細情報はありません。",
            apiNodeId: node.id,
            all_qids: node.extend_query || node.all_node_qids || [], 
        },
    }));
    const transformedEdges: Edge[] = (apiMapData.edges || []).map((edge:any, i:any) => ({
        id: `e-${String(edge.source)}-${String(edge.target)}-${i}`,
        source: String(edge.source),
        target: String(edge.target),
        animated: true,
    }));
    setNodes(transformedNodes);
    setEdges(transformedEdges);
    setTimeout(() => setLayoutTrigger(p => p + 1), 100);
  }, [mapDataFromApi, setNodes, setEdges]);
  
  const handleApplyTemporalMap = useCallback((newNodes: CustomNodeType[], newEdges: Edge[]) => {
    setNodes((currentNodes) => [...currentNodes, ...newNodes]);
    setEdges((currentEdges) => [...currentEdges, ...newEdges]);
    setTimeout(() => setLayoutTrigger(p => p + 1), 100);
  }, [setNodes, setEdges]);
  
  const handleNodeAdded = useCallback((newNode: CustomNodeType | null, newEdge: Edge) => {
    if (newNode) {
      setNodes((nds) => [...nds, newNode]);
    }
    if (newEdge) {
      setEdges((eds) => [...eds, newEdge]);
    }
    setTimeout(() => setLayoutTrigger(p => p + 1), 100);
  }, [setNodes, setEdges]);

  const applyMapData = useCallback((mapData: KnowledgeMap['map_data'] | null) => {
    if (mapData && Array.isArray(mapData.nodes)) {
      const loadedNodes: CustomNodeType[] = mapData.nodes.map((savedNode: any) => {
        const hasNewStructure = savedNode.data && typeof savedNode.data.label !== 'undefined';
        const nodeData = hasNewStructure ? savedNode.data : savedNode;

        return {
          id: String(savedNode.id),
          position: savedNode.position || { x: Math.random() * 400, y: Math.random() * 300 },
          type: savedNode.type || 'default',
          data: {
              label: nodeData.label,
              sentence: nodeData.sentence || "詳細情報はありません。",
              apiNodeId: nodeData.apiNodeId || savedNode.id,
              all_qids: nodeData.all_qids || nodeData.extend_query || [],
          },
        };
      });
      
      const loadedEdges: Edge[] = (mapData.edges || []).map((e: any) => ({
        id: String(e.id), source: String(e.source), target: String(e.target), animated: e.animated,
      }));

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setTimeout(() => setLayoutTrigger(p => p + 1), 100);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);

  const loadLatestData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const memos = await memoService.getMemos();
      if (memos && memos.length > 0) {
        const latestMemo = memos[0];
        setCurrentMemo(latestMemo);
        const mapResponse = await mapService.getMap(latestMemo.id);
        applyMapData(mapResponse.map_data);
        toast({ title: "成功", description: "以前のデータを読み込みました。" });
      } else {
        setIsMemoPanelOpen(true);
      }
    } catch (error: any) {
      toast({ title: "データ読み込みエラー", description: "以前のデータの読み込みに失敗しました。", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [toast, applyMapData]);

  useEffect(() => {
    loadLatestData();
  }, [loadLatestData]);

  useEffect(() => {
    if (isLoadingData || !currentMemo) {
      return;
    }
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      const mapDataToSave = {
        nodes: nodes.map(n => ({ id: n.id, data: n.data, position: n.position, type: n.type })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, animated: e.animated })),
      };
      
      mapService.updateMap(currentMemo.id, mapDataToSave)
        .then(() => console.log("DashboardPage: マップの自動保存に成功しました。"))
        .finally(() => setIsSaving(false));
    }, 2000);

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [nodes, edges, currentMemo, isLoadingData, toast]);

  // ★★★ 修正点: 新しいサービスを呼び出すように変更 ★★★
  const handleSaveAndGenerate = useCallback(async (text: string) => {
    if (!text.trim()) {
      toast({ title: "入力エラー", description: "メモ内容が空です。", variant: "destructive" });
      return;
    }
    try {
      // 1. メモと初期マップの作成を一度にリクエスト
      const { memo: savedMemo, map: initialMap } = await memoService.createMemoWithMap(text);
      
      // 2. 返ってきたデータでstateを更新
      setCurrentMemo(savedMemo);
      applyMapData(initialMap.map_data);
      
      toast({ title: "成功", description: "新しいメモとマップを作成しました。" });
    } catch (error: any) {
      toast({ title: "処理エラー", description: "メモとマップの作成に失敗しました。", variant: "destructive" });
    } finally {
      setIsMemoPanelOpen(false);
    }
  }, [toast, applyMapData]);

  return (
    <div className="w-screen h-screen bg-[#1a202c] text-white overflow-hidden relative font-sans">
      <main className={`absolute inset-0 transition-all duration-500 ease-in-out ${isMemoPanelOpen ? 'ml-[400px]' : 'ml-0'}` }>
        <KnowledgeMapDisplay 
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeAdded={handleNodeAdded}
          onApplyTemporalMap={handleApplyTemporalMap}
          layoutTrigger={layoutTrigger}
          onConnect={onConnect} // ★ 変更点: onConnect ハンドラを渡す
          onManualNodeAdd={handleManualNodeAdd} // ★ 変更点: 手動追加ハンドラを渡す
        />
      </main>

      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="absolute top-8 right-8 bottom-8 w-8 border-l-2 border-r-2 border-blue-400/20"></div>
      </div>

      <aside className="absolute top-1/2 right-8 -translate-y-1/2 flex flex-col items-center gap-4 z-20">
        <Button variant="ghost" size="icon" className="bg-gray-700/50 hover:bg-gray-600/70 rounded-full w-12 h-12 backdrop-blur-sm">
          <Cog className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" className="bg-gray-700/50 hover:bg-gray-600/70 rounded-full w-12 h-12 backdrop-blur-sm">
          <Award className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" className="bg-gray-700/50 hover:bg-gray-600/70 rounded-full w-12 h-12 backdrop-blur-sm">
          <History className="w-6 h-6" />
        </Button>
        <Button 
          onClick={() => setIsMemoPanelOpen(true)}
          variant="ghost" 
          size="icon" 
          className="bg-blue-500/80 hover:bg-blue-400/90 rounded-full w-20 h-20 backdrop-blur-sm mt-4"
        >
          <FileText className="w-10 h-10" />
        </Button>
      </aside>
      
      <aside className={`absolute top-0 left-0 h-full w-[400px] bg-gray-900/80 backdrop-blur-md border-r border-blue-400/20 shadow-2xl transition-transform duration-500 ease-in-out z-30 ${isMemoPanelOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center"><Brain className="mr-2"/>ActivityReportの下書き</h2>
            <Button onClick={() => setIsMemoPanelOpen(false)} variant="ghost" size="icon"><X className="w-6 h-6" /></Button>
          </div>
          <div className="flex-grow flex flex-col min-h-0">
            <MemoInput 
              initialText={currentMemo?.content || ''} 
              onSave={handleSaveAndGenerate}
              isloading={isLoadingData}
              memokey={currentMemo?.id}
            />
          </div>
        </div>
      </aside>

      {isSaving && <div className="absolute bottom-4 right-8 z-20 text-xs text-muted-foreground animate-pulse">マップを自動保存中...</div>}
    </div>
  );
}

export default DashboardPage;
