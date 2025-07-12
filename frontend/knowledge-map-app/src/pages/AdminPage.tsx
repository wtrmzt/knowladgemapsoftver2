// src/pages/AdminPage.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { InspectorView } from '../components/admin/InspectorView';
// ★★★ ここが重要な修正点 ★★★
// default exportされたコンポーネントを正しくインポートします。
import CombinedMapView from '../components/admin/CombinedMapView';

function AdminPage() {
    const [activeView, setActiveView] = useState<'inspector' | 'combined'>('inspector');

    return (
        <div className="w-full h-full flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">開発者ツール</h1>
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
            </div>

            {activeView === 'inspector' && <InspectorView />}
            {activeView === 'combined' && <CombinedMapView />}
        </div>
    );
}

export default AdminPage;
