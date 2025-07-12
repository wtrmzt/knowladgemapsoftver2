// src/components/admin/InspectorView.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNodesState, useEdgesState, ReactFlow, Controls, Background, MiniMap } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import { adminService } from '../../services/adminService';
import { mapService } from '../../services/mapService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, FileText, GitBranch, RotateCcw } from 'lucide-react';
import type { CustomNodeData } from '../../types';

type CustomNodeType = Node<CustomNodeData>;

export function InspectorView() {
    const { toast } = useToast();
    const [users, setUsers] = useState<{ id: number; username: string }[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [memos, setMemos] = useState<{ id: number; content: string }[]>([]);
    const [selectedMemoId, setSelectedMemoId] = useState<string>('');
    const [history, setHistory] = useState<any[]>([]);
    const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number>(0);
    
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isRollingBack, setIsRollingBack] = useState(false);

    useEffect(() => {
        adminService.getAllUsers().then(setUsers).catch(() => toast({ title: "ユーザーリストの取得に失敗", variant: "destructive" }));
        adminService.getSystemStats().then(setStats).catch(() => toast({ title: "統計情報の取得に失敗", variant: "destructive" }));
    }, [toast]);

    useEffect(() => {
        if (!selectedUserId) return;
        setMemos([]);
        setSelectedMemoId('');
        setHistory([]);
        adminService.getUserMemos(Number(selectedUserId)).then(setMemos).catch(() => toast({ title: "メモリストの取得に失敗", variant: "destructive" }));
    }, [selectedUserId, toast]);

    useEffect(() => {
        if (!selectedMemoId) return;
        setHistory([]);
        adminService.getMapHistory(Number(selectedMemoId))
            .then(historyData => {
                setHistory(historyData);
                if (historyData.length > 0) setSelectedHistoryIndex(historyData.length - 1);
            })
            .catch(() => toast({ title: "マップ履歴の取得に失敗", variant: "destructive" }));
    }, [selectedMemoId, toast]);

    useEffect(() => {
        if (history && history.length > 0 && selectedHistoryIndex < history.length) {
            const mapData = history[selectedHistoryIndex].map_data;
            if (mapData && Array.isArray(mapData.nodes)) {
                const loadedNodes: CustomNodeType[] = (mapData.nodes || []).map((n: any) => {
                    const nodeData = n.data || n;
                    return {
                        id: String(n.id),
                        position: n.position || { x: Math.random() * 200, y: Math.random() * 200 },
                        data: { label: nodeData.label, sentence: nodeData.sentence, apiNodeId: nodeData.apiNodeId || n.id },
                        type: n.type || 'default',
                    };
                });
                const loadedEdges: Edge[] = (mapData.edges || []).map((e: any) => ({
                    id: String(e.id), source: String(e.source), target: String(e.target), animated: e.animated,
                }));
                setNodes(loadedNodes);
                setEdges(loadedEdges);
            }
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [selectedHistoryIndex, history, setNodes, setEdges]);
    
    const handleSaveChanges = useCallback(async () => {
        if (!selectedMemoId) return;
        setIsSaving(true);
        const mapDataToSave = {
            nodes: nodes.map(n => ({ id: n.id, data: n.data, position: n.position, type: n.type })),
            edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, animated: e.animated })),
        };
        try {
            await mapService.updateMap(Number(selectedMemoId), mapDataToSave);
            toast({ title: "成功", description: "マップの変更が新しい履歴として保存されました。" });
            const updatedHistory = await adminService.getMapHistory(Number(selectedMemoId));
            setHistory(updatedHistory);
            setSelectedHistoryIndex(updatedHistory.length - 1);
        } catch (error) { toast({ title: "保存失敗", variant: "destructive" });
        } finally { setIsSaving(false); }
    }, [selectedMemoId, nodes, edges, toast]);

    const handleRollback = useCallback(async () => {
        if (!selectedMemoId || history.length === 0) return;
        const historyToRollback = history[selectedHistoryIndex];
        if (!historyToRollback) return;
        setIsRollingBack(true);
        try {
            await adminService.rollbackToHistory(Number(selectedMemoId), historyToRollback.history_id);
            toast({ title: "成功", description: "指定したバージョンにロールバックしました。" });
            const updatedHistory = await adminService.getMapHistory(Number(selectedMemoId));
            setHistory(updatedHistory);
            setSelectedHistoryIndex(updatedHistory.length - 1);
        } catch (error) { toast({ title: "ロールバック失敗", variant: "destructive" });
        } finally { setIsRollingBack(false); }
    }, [selectedMemoId, history, selectedHistoryIndex, toast]);

    return (
        <div className="w-full h-full flex flex-col gap-4">
            {stats && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">総ユーザー数</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total_users}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">総メモ数</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total_memos}</div></CardContent></Card>
                    <Card><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">総マップ更新回数</CardTitle><GitBranch className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stats.total_map_revisions}</div></CardContent></Card>
                </div>
            )}
             {stats && stats.user_activity && (
                <Card className="col-span-1 lg:col-span-2"><CardHeader><CardTitle>ユーザー活動状況</CardTitle></CardHeader><CardContent>
                    <Table><TableHeader><TableRow><TableHead>ユーザー名</TableHead><TableHead>メモ数</TableHead><TableHead>マップ更新回数</TableHead></TableRow></TableHeader>
                        <TableBody>{stats.user_activity.map((act: any) => (<TableRow key={act.username}><TableCell>{act.username}</TableCell><TableCell>{act.memo_count}</TableCell><TableCell>{act.revision_count}</TableCell></TableRow>))}</TableBody>
                    </Table>
                </CardContent></Card>
            )}
            <div className="flex gap-4 items-center pt-4 border-t">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}><SelectTrigger className="w-[180px]"><SelectValue placeholder="ユーザーを選択" /></SelectTrigger><SelectContent>{users.map(u => <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>)}</SelectContent></Select>
                <Select value={selectedMemoId} onValueChange={setSelectedMemoId} disabled={!selectedUserId}><SelectTrigger className="w-[280px]"><SelectValue placeholder="メモを選択" /></SelectTrigger><SelectContent>{memos.map(m => <SelectItem key={m.id} value={String(m.id)}>ID:{m.id} - {m.content.substring(0, 20)}...</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="flex-grow w-full border rounded-md relative min-h-0">
                <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView><Controls /><Background /><MiniMap /></ReactFlow>
            </div>
            {history.length > 0 && (
                <div className="flex items-center gap-4 p-4 border-t">
                    <div className="text-sm font-medium whitespace-nowrap">履歴 ({selectedHistoryIndex + 1} / {history.length})</div>
                    <Slider min={0} max={history.length - 1} step={1} value={[selectedHistoryIndex]} onValueChange={(v) => setSelectedHistoryIndex(v[0])} className="flex-grow" />
                    <Button onClick={handleRollback} disabled={isRollingBack || isSaving} variant="destructive"><RotateCcw className="w-4 w-4 mr-2"/>このバージョンにロールバック</Button>
                    <Button onClick={handleSaveChanges} disabled={isSaving || isRollingBack}>{isSaving ? "保存中..." : "変更を保存"}</Button>
                </div>
            )}
        </div>
    );
}
