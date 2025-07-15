// src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // ★★★ Linkをインポート ★★★
import { authService } from '../services/authService';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { LogIn, User as UserIcon, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      const appToken = await authService.login(username);
      localStorage.setItem('jwt_token', appToken);
      if (appToken) {
        onLoginSuccess();
        navigate('/dashboard');
        toast({ title: "ログイン成功", description: `ようこそ、${username}さん！` });
      } else {
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

  // ★★★ 同意書ページのパスを定義 ★★★
  const consentPagePath = "/consent"; // ここは実際の同意書ページのパスに合わせてください

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
                        className="pl-10"
                        disabled={isLoading}
                    />
                 </div>
            </div>
        </div>
        
        <Button onClick={handleLogin} className="w-full mt-8" disabled={isLoading || !username}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          ログイン
        </Button>

        {/* ★★★ 同意書へのリンクを追加 ★★★ */}
        <div className="mt-6 text-sm">
            <p className="text-muted-foreground">
                ログインすることで、
                <Link to={consentPagePath} className="underline text-primary hover:text-primary/80 mx-1">
                    実験への同意書
                </Link>
                に同意したものとみなされます。
            </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
