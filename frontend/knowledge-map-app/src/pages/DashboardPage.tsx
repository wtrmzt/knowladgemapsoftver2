// src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNodesState, useEdgesState } from 'reactflow';
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

// --- 新しいUIのためのメインコンポーネント ---
function DashboardPage() {
  const { toast } = useToast();

  // --- 既存のState管理ロジック (全て保持) ---
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNodeData>([]);

  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);
  const [currentMemo, setCurrentMemo] = useState<Memo | null>(null);
  const [mapDataFromApi] = useState<ApiKnowledgeMapResponse | null>(null);

  const [isMemoPanelOpen, setIsMemoPanelOpen] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  // メモ保存・マップ生成中の状態は未使用のため削除
  const [layoutTrigger, setLayoutTrigger] = useState(0);

  // ★★★ 自動保存のための状態を追加 ★★★
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // --- 既存のデータ処理・イベントハンドラ (全て保持) ---
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
  
  // handleApplyTemporalMapとhandleNodeAddedの引数とロジックを修正
  const handleApplyTemporalMap = useCallback((newNodes: CustomNodeType[], newEdges: Edge[]) => {
    // 既存のノードと新しいノードを結合
    setNodes((currentNodes) => [...currentNodes, ...newNodes]);
    setEdges((currentEdges) => [...currentEdges, ...newEdges]);
    // レイアウト更新をトリガー
    setTimeout(() => setLayoutTrigger(p => p + 1), 100);
  }, [setNodes, setEdges]);
  
  // `newNode`がnullの場合（エッジのみ追加）も考慮するように修正
  const handleNodeAdded = useCallback((newNode: CustomNodeType | null, newEdge: Edge) => {
    if (newNode) {
      setNodes((nds) => [...nds, newNode]);
    }
    if (newEdge) {
      setEdges((eds) => [...eds, newEdge]);
    }
    setTimeout(() => setLayoutTrigger(p => p + 1), 100);
  }, [setNodes, setEdges]);

  // APIから取得したマップデータをReact Flowの形式に変換し、stateを更新する関数
  const applyMapData = useCallback((mapData: KnowledgeMap['map_data'] | null) => {
    console.log("DashboardPage: Applying map data from server:", mapData);
    if (mapData && Array.isArray(mapData.nodes)) {
      const loadedNodes: CustomNodeType[] = mapData.nodes.map((savedNode: any) => {
        // ★★★ ここが重要な修正点 ★★★
        // 新旧のデータ構造を判別し、どちらの形式でも正しく情報を抽出します。
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

      console.log("DashboardPage: Transformed nodes for React Flow:", loadedNodes);
      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setTimeout(() => setLayoutTrigger(p => p + 1), 100);
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [setNodes, setEdges]);


  // ページ読み込み時に最新のメモとマップを取得する関数
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
      // ★★★ 重要な修正: ローディング完了を正しく設定 ★★★
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

  // メモを保存し、続けてマップを生成する関数
  const handleSaveAndGenerate = useCallback(async (text: string) => {
    if (!text.trim()) {
      toast({ title: "入力エラー", description: "メモ内容が空です。", variant: "destructive" });
      return;
    }
    loggingService.logActivity('SAVE_AND_GENERATE_MAP', { memoLength: text.length });
    try {
      const savedMemo = await memoService.createMemo(text);
      setCurrentMemo(savedMemo);
      toast({ title: "成功", description: "メモを保存しました。" });
      
      const mapResponse = await mapService.generateMap(savedMemo.id);
      applyMapData(mapResponse.map_data);
      toast({ title: "成功", description: "知識マップを生成/更新しました。" });
    } catch (error: any) {
      toast({ title: "処理エラー", description: "マップの生成または保存に失敗しました。", variant: "destructive" });
    } finally {
      setIsMemoPanelOpen(false);
    }
  }, [toast, applyMapData]);
  

  return (
    // --- 全体のコンテナ ---
    <div className="w-screen h-screen bg-[#1a202c] text-white overflow-hidden relative font-sans">
      
      {/* --- メインコンテンツエリア (マップ表示領域) --- */}
      {/* ★★★ inset-0 でウィンドウ全体に広げ、メモパネルの状態で左マージンを制御 ★★★ */}
      <main className={`absolute inset-0 transition-all duration-500 ease-in-out ${isMemoPanelOpen ? 'ml-[400px]' : 'ml-0'}` }>
        <KnowledgeMapDisplay 
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeAdded={handleNodeAdded}
          onApplyTemporalMap={handleApplyTemporalMap}          // layoutTriggerをpropsとして渡す
          layoutTrigger={layoutTrigger}
        />
      </main>


      {/* --- 背景デザイン要素 (マップの上にオーバーレイ) --- */}
      {/* ★★★ pointer-events-noneで、下のマップへのクリックを透過させる ★★★ */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/*<div className="absolute top-8 left-8 right-8 h-12 border-t-2 border-b-2 border-blue-400/20"></div>
        <div className="absolute bottom-8 left-8 right-8 h-8 border-b-2 border-blue-400/20"></div>
        <div className="absolute top-8 left-8 bottom-8 w-8 border-l-2 border-r-2 border-blue-400/20"></div>*/}
        <div className="absolute top-8 right-8 bottom-8 w-8 border-l-2 border-r-2 border-blue-400/20"></div>
      </div>

      {/* --- 右側のフローティングメニュー (最前面から2番目) --- */}
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
            <h2 className="text-xl font-bold flex items-center"><Brain className="mr-2"/>学習メモ</h2>
            <Button onClick={() => setIsMemoPanelOpen(false)} variant="ghost" size="icon"><X className="w-6 h-6" /></Button>
          </div>
          <div className="flex-grow flex flex-col min-h-0">
            <MemoInput 
              initialText={currentMemo?.content || ''} 
              onSave={handleSaveAndGenerate}
              isloading={isLoadingData} // isLoadingをpropsとして渡す
              memokey={currentMemo?.id} // メモのIDをkeyとして渡す
            />
          </div>
        </div>
      </aside>

      {isSaving && <div className="absolute bottom-4 right-8 z-20 text-xs text-muted-foreground animate-pulse">マップを自動保存中...</div>}
    </div>
  );
}

export default DashboardPage;