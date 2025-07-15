// src/components/MemoInput.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
//import { Save, Palette } from 'lucide-react';
import { Save } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MemoInputProps {
  initialText: string;
  onSave: (text: string) => Promise<void> | void;
  isloading?: boolean; // isLoadingはオプションに変更
  memokey?: React.Key; // keyをpropsとして受け取れるように追記
}

const availableColors = [
  { name: '白', value: '#E2E8F0' }, // デフォルトのテキストカラーに合わせる
  { name: '赤', value: '#F87171' },
  { name: '青', value: '#60A5FA' },
  { name: '緑', value: '#4ADE80' },
  { name: '黄', value: '#FBBF24' },
];

function MemoInput({ initialText, onSave, memokey }: MemoInputProps) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setText(initialText);
  }, [initialText, memokey]); // keyも依存配列に追加

  const handleSaveClick = () => {
    console.log("MemoInput: Save button clicked. Calling onSave prop.");
    onSave(text);
  };

  const applyColor = (colorValue: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      if (start !== end) {
        const selectedText = text.substring(start, end);
        const newText = 
          text.substring(0, start) + 
          `<color:${colorValue}>${selectedText}</color>` + 
          text.substring(end);
        setText(newText);
        
        textareaRef.current.focus();
        setTimeout(() => {
          if(textareaRef.current) {
            const newPosition = start + `<color:${colorValue}>${selectedText}</color>`.length;
            textareaRef.current.setSelectionRange(newPosition, newPosition);
          }
        }, 0);
      } else {
        alert("色を変更したいテキストを選択してください。");
      }
    }
  };

  return (
    <div className="flex flex-col h-full" key={memokey}>
      <div className="mb-2 flex items-center gap-2 flex-shrink-0"> {/* flex-shrink-0 を追加 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {/*<Button variant="outline" size="sm" className="bg-gray-700 border-gray-600 hover:bg-gray-600 text-white">
              <Palette className="h-4 w-4 mr-2" />
              文字色
            </Button>*/}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-gray-800 border-gray-700 text-white">
            {availableColors.map((color) => (
              <DropdownMenuItem 
                key={color.value} 
                onClick={() => applyColor(color.value)} 
                style={{ color: color.value }}
                className="focus:bg-gray-700"
              >
                {color.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="ここに学習した内容をメモしましょう..."
        // ★★★ ここが重要な修正点 ★★★
        // ダークモード用のスタイルと、レイアウト用のスタイルを統合
        className="
          flex-grow                      /* 親のスペースを埋める（既存の正しい設定） */
          resize-none                    /* 手動リサイズ無効（既存の正しい設定） */
          bg-gray-800                    /* 背景色をダークテーマに */
          text-gray-200                  /* 基本の文字色を明るく */
          border                         /* 枠線を表示 */
          border-gray-600                /* 枠線の色を調整 */
          rounded-md                     /* 角を丸める */
          p-3                            /* 内側の余白 */
          text-base                      /* 文字サイズ（既存の設定） */
          focus-visible:outline-none     /* shadcn/uiの推奨するフォーカス設定 */
          focus-visible:ring-2
          focus-visible:ring-blue-500
          focus-visible:ring-offset-2
          focus-visible:ring-offset-gray-900
        "
      />
      {/* 保存ボタンは現状のままでOKです */}
      <Button onClick={handleSaveClick} className="mt-4 w-full flex-shrink-0 bg-green-600 hover:bg-green-500">
        <Save className="mr-2 h-4 w-4" />
        メモを保存/マップの新規作成
      </Button>
    </div>
  );
}

export default MemoInput;