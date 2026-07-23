import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // @bunny.net/agent-react is a linked workspace package; make sure its deps
  // (base-ui, @shadcn/react, streamdown) share the app's single React copy.
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3000,
    proxy: {
      "/api": "http://localhost:8787",
    },
  },
});
