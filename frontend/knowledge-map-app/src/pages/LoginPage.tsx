// src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LogIn, User as UserIcon } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  // ★★★ 修正: ユーザーIDを管理するためのStateを追加 ★★★
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // ★★★ 修正: IDとパスワードでログインするハンドラを実装 ★★★
  const handleLogin = async () => {
    if (!username.trim()) {
      toast({
        title: "入力エラー",
        description: "ユーザーIDを入力してください。",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      // 修正したauthServiceのlogin関数を呼び出す
      const appToken = await authService.login(username);
      if (appToken) {
        onLoginSuccess();
        navigate('/dashboard');
        toast({ title: "ログイン成功", description: `ようこそ、${username}さん！` });
      } else {
        // このケースは通常発生しないが、念のため
        throw new Error("アプリケーショントークンが取得できませんでした。");
      }
    } catch (error: any) {
      toast({
        title: "ログイン失敗",
        description: error?.response?.data?.message || "ユーザーIDが正しくありません。",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)]">
      <div className="bg-card p-8 rounded-lg shadow-xl w-full max-w-md text-center border">
        <LogIn className="mx-auto h-16 w-16 text-primary mb-6" />
        <h1 className="text-3xl font-bold mb-2 text-card-foreground">ログイン</h1>
        <p className="mb-8 text-muted-foreground">ユーザーIDを入力してログインしてください。</p>
        
        <div className="space-y-4 text-left">
            <div className="space-y-2">
                 <Label htmlFor="username">ユーザーID</Label>
                 <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        id="username"
                        type="text"
                        placeholder="ユーザーIDを入力"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="pl-10" // アイコンの分のスペースを確保
                        disabled={isLoading}
                    />
                 </div>
            </div>
        </div>
        
        <Button onClick={handleLogin} className="w-full mt-8" disabled={isLoading || !username}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          ログイン
        </Button>
      </div>
    </div>
  );
}

// ローディングインジケーター用のコンポーネント
const Loader2 = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);


export default LoginPage;
