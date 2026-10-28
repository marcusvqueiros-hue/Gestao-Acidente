import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  // navegadores mais antigos (iOS 14+, Android com Chrome atualizado)
  build: { target: ["es2019", "chrome80", "safari14", "firefox78", "edge88"] },
});
