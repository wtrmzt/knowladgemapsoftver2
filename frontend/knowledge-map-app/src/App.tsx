// src/App.tsx
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow'; 
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AdminPage from './pages/AdminPage';
import { authService } from './services/authService';
import { Toaster } from "@/components/ui/toaster";
import { Shield } from 'lucide-react';
import ConsentPage from './pages/ConsentPage'; // ★★★ 同意書ページをインポート ★★★

const Navbar: React.FC<{ isAuthenticated: boolean; isAdmin: boolean; onLogout: () => void }> = ({ isAuthenticated, isAdmin, onLogout }) => {
  if (!isAuthenticated) return null;
  return (
    <header className="bg-card border-b flex-shrink-0">
      <nav className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to={isAdmin ? "/admin" : "/dashboard"} className="font-bold">知識マップツール</Link>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <Link to="/admin" className="text-sm text-primary hover:underline flex items-center">
              <Shield className="w-4 h-4 mr-1" />
              管理画面
            </Link>
          )}
          <button onClick={onLogout} className="text-sm text-muted-foreground hover:underline">ログアウト</button>
        </div>
      </nav>
    </header>
  );
};

const AdminRoute = ({ isAdmin }: { isAdmin: boolean }) => {
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());
  const [isAdmin, setIsAdmin] = useState(() => authService.isAdmin());
  const [userKey, setUserKey] = useState(() => authService.getUserIdFromToken());

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setIsAdmin(authService.isAdmin());
    setUserKey(authService.getUserIdFromToken());
  };

  const handleLogout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setIsAdmin(false);
    setUserKey(null);
  };
  
  return (
    <Router>
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <Navbar isAuthenticated={isAuthenticated} isAdmin={isAdmin} onLogout={handleLogout} />
        {/* ★★★ 重要な修正: mainにflex-grow、min-h-0を追加し、paddingを調整 ★★★ */}
        <main className="flex-grow min-h-0 w-full">
          <div className="container p-4 h-full flex flex-col">
            <Routes>
              {/* ログインページ: 認証済みなら権限に応じてリダイレクト */}
              <Route 
                path="/login" 
                element={!isAuthenticated ? <LoginPage onLoginSuccess={handleLoginSuccess} /> : <Navigate to={isAdmin ? "/admin" : "/dashboard"} />} 
              />
              {/* 同意書ページ: 認証済みなら表示、未認証ならログインページへリダイレクト */}
              <Route path="/consent" element={<ConsentPage />} /> 

              {/* ユーザー用ダッシュボード: 管理者はAdminページへリダイレクト */}
              <Route 
                path="/dashboard" 
                element={
                  !isAuthenticated ? <Navigate to="/login" /> : 
                  isAdmin ? <Navigate to="/admin" /> : 
                  <ReactFlowProvider>
                    <div className="w-full h-full">
                      <DashboardPage key={userKey} />
                    </div>
                  </ReactFlowProvider>
                } 
              />

              {/* 管理者専用ルート */}
              <Route element={<AdminRoute isAdmin={isAdmin} />}>
                <Route 
                  path="/admin" 
                  element={
                    <ReactFlowProvider>
                      <div className="w-full h-full">
                        <AdminPage />
                      </div>
                    </ReactFlowProvider>
                  } 
                />
              </Route>

              {/* ルートパス ("/") のリダイレクト */}
              <Route 
                path="/" 
                element={<Navigate to={isAuthenticated ? (isAdmin ? "/admin" : "/dashboard") : "/login"} />} 
              />

              {/* 存在しないURLはルートパスにリダイレクト */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </div>
        </main>
        <Toaster />
      </div>
    </Router>
  );
}

export default App;