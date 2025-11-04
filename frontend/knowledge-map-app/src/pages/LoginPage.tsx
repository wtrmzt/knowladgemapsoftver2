// src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react'; // ★ useEffect をインポート
import { useNavigate, Link } from 'react-router-dom';
// ★★★ エラー修正: インポートパスを '../' から '@/' に変更 ★★★
import { authService } from '@/services/authService';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LogIn, User as UserIcon, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

// ★★★ 発表用の固定ユーザーID ★★★
const DEMO_USERNAME = 'demo_user'; // このユーザーで自動ログインします

function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  // ★ 変更点: username の初期値をデモユーザーIDに設定
  const [username, setUsername] = useState(DEMO_USERNAME);
  const [isLoading, setIsLoading] = useState(true); // ★ 変更点: 初期値を true にしてローディング開始

  const handleLogin = async (loginUsername: string) => { // ★ 引数を取るように変更
    if (!loginUsername.trim()) {
      toast({
        title: "入力エラー",
        description: "ユーザーIDがありません。",
        variant: "destructive",
      });
      setIsLoading(false); // ★ ローディング解除
      return;
    }
    setIsLoading(true);
    try {
      const appToken = await authService.login(loginUsername);
      localStorage.setItem('jwt_token', appToken);
      if (appToken) {
        onLoginSuccess();
        navigate('/dashboard');
        toast({ title: "Sucsessfully Auto Login", description: `Hello!${loginUsername}！` });
      } else {
        throw new Error("アプリケーショントークンが取得できませんでした。");
      }
    } catch (error: any) {
      toast({
        title: "自動ログイン失敗",
        description: error?.response?.data?.message || "デモユーザーのログインに失敗しました。",
        variant: "destructive"
      });
      // ★ 失敗したらローディングを解除し、手動ログインできるようにする
      setIsLoading(false); 
    } 
    // ★ 成功時は navigate するので finally は不要
  };

  // ★★★ 発表のための自動ログイン処理 ★★★
  useEffect(() => {
    // ページが読み込まれたら、デモユーザーで自動ログインを実行
    toast({ title: "demo system", description: `${DEMO_USERNAME} ` });
    handleLogin(DEMO_USERNAME);
    
    // この effect はマウント時に1回だけ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // (手動ログイン用のハンドラも残しておく)
  const handleManualLoginClick = () => {
     handleLogin(username);
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleManualLoginClick();
    }
  };

  // ★★★ 同意書ページのパスを定義 ★★★
  const consentPagePath = "/consent"; // ここは実際の同意書ページのパスに合わせてください

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
      <div className="bg-card p-8 rounded-lg shadow-xl w-full max-w-md text-center border">
        <LogIn className="mx-auto h-16 w-16 text-primary mb-6" />
        
        {/* ★ 変更点: ローディング状態に応じて表示を変更 */}
        {isLoading ? (
            <>
                <h1 className="text-3xl font-bold mb-2 text-card-foreground">Auto Login...</h1>
                <p className="mb-8 text-muted-foreground">Move Dashboard by {DEMO_USERNAME}</p>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            </>
        ) : (
            <>
                <h1 className="text-3xl font-bold mb-2 text-card-foreground">Login</h1>
                <p className="mb-8 text-muted-foreground">自動ログインに失敗しました。手動でログインしてください。</p>
                
                <div className="space-y-4 text-left">
                    <div className="space-y-2">
                        <Label htmlFor="username">UserID</Label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input 
                                id="username"
                                type="text"
                                placeholder="ID"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                onKeyPress={handleKeyPress}
                                className="pl-10"
                                disabled={isLoading}
                            />
                        </div>
                    </div>
                </div>
                
                <Button onClick={handleManualLoginClick} className="w-full mt-8" disabled={isLoading || !username}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                ログイン
                </Button>

                <div className="mt-6 text-sm">
                    <p className="text-muted-foreground">
                        ログインすることで、
                        <Link to={consentPagePath} className="underline text-primary hover:text-primary/80 mx-1">
                            実験への同意書
                        </Link>
                        に同意したものとみなされます。
                    </p>
                </div>
            </>
        )}
      </div>
    </div>
  );
}

export default LoginPage;

