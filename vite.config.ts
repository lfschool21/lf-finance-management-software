import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  if (mode === "test") {
    const environment = loadEnv(mode, process.cwd(), "VITE_");
    if (!environment.VITE_SUPABASE_URL) {
      throw new Error("Test mode requires a dedicated local VITE_SUPABASE_URL");
    }
    const hostname = new URL(environment.VITE_SUPABASE_URL).hostname;
    if (!["127.0.0.1", "localhost", "::1"].includes(hostname)) {
      throw new Error(`Test mode refuses non-local Supabase host: ${hostname}`);
    }
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});
