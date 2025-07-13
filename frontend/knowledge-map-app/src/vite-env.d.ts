// vite.config.ts
import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // 他の環境変数をここに追加できます
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
