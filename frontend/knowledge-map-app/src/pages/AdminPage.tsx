// src/pages/AdminPage.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InspectorView } from '../components/admin/InspectorView';
import CombinedMapView from '../components/admin/CombinedMapView';
import { Download } from 'lucide-react'; // アイコンをインポート

function AdminPage() {
    const [activeView, setActiveView] = useState<'inspector' | 'combined'>('inspector');
    const [isDownloading, setIsDownloading] = useState(false);

    // データベースをダウンロードする関数
    const handleDownloadDb = async () => {
        setIsDownloading(true);
        const token = localStorage.getItem('jwt_token');
        if (!token) {
            alert('管理者としてログインしていません。');
            setIsDownloading(false);
            return;
        }

        // 環境変数からAPIのベースURLを取得。なければローカルのURLを仮定。
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';

        try {
            const response = await fetch(`${apiUrl}/admin/export_csv`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'データベースのダウンロードに失敗しました。');
            }

            // ファイルをBlobとして取得
            const blob = await response.blob();
            // ダウンロード用のURLを生成
            const downloadUrl = window.URL.createObjectURL(blob);
            
            // aタグを生成してクリックさせ、ダウンロードを実行
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', 'knowledge_map_mvp.db'); // ダウンロードファイル名
            document.body.appendChild(link);
            link.click();

            // 後処理
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);

        } catch (error) {
            console.error('Download error:', error);
            alert(`エラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col gap-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4 p-2 border-b">
                <h1 className="text-2xl font-bold">開発者ツール</h1>
                <div className="flex items-center gap-2">
                    {/* ビュー切り替えボタン */}
                    <div className="flex gap-2 p-1 bg-muted rounded-md">
                        <Button
                            variant={activeView === 'inspector' ? 'secondary' : 'ghost'}
                            onClick={() => setActiveView('inspector')}
                        >
                            個別インスペクター
                        </Button>
                        <Button
                            variant={activeView === 'combined' ? 'secondary' : 'ghost'}
                            onClick={() => setActiveView('combined')}
                        >
                            統合マップ
                        </Button>
                    </div>
                    {/* ★★★ DBダウンロードボタンをここに追加 ★★★ */}
                    <Button 
                        onClick={handleDownloadDb} 
                        disabled={isDownloading}
                        variant="outline"
                    >
                        <Download className="mr-2 h-4 w-4" />
                        {isDownloading ? 'ダウンロード中...' : 'データベースをダウンロード'}
                    </Button>
                </div>
            </div>

            {activeView === 'inspector' && <InspectorView />}
            {activeView === 'combined' && <CombinedMapView />}
        </div>
    );
}

export default AdminPage;
