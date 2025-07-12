// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path" // Node.jsのpathモジュールをインポート

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // "@" を "src" ディレクトリへのパスにマッピング
      "@": path.resolve(__dirname, "./src"), 
    },
  },
})