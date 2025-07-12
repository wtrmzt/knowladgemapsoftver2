import { Link, useNavigate } from 'react-router-dom';
import { Button } from "./ui/button";
import { LogOut, BookOpen, UserCircle, Settings } from 'lucide-react'; // アイコン
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"; // shadcn/ui

interface NavbarProps {
  isAuthenticated: boolean;
  onLogout: () => void;
}

function Navbar({ isAuthenticated, onLogout }: NavbarProps) {
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <nav className="bg-card shadow-sm border-b">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="flex items-center text-xl font-bold text-primary">
          <BookOpen className="mr-2 h-6 w-6" />
          知識マップツール
        </Link>
        <div>
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center">
                  <UserCircle className="mr-2 h-5 w-5" />
                  アカウント
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>マイアカウント</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  ダッシュボード
                </DropdownMenuItem>
                <DropdownMenuItem disabled> {/* 将来的な機能のためのプレースホルダー */}
                  <Settings className="mr-2 h-4 w-4" />
                  設定
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogoutClick} className="text-red-600 dark:text-red-400">
                  <LogOut className="mr-2 h-4 w-4" />
                  ログアウト
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline">
              <Link to="/login">ログイン</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
