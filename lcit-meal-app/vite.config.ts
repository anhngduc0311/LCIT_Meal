import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cjsInterop } from "vite-plugin-cjs-interop";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    cjsInterop({
      dependencies: ["@mdi/react"],
    }),
  ],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["com365.lcit.vn", "localhost"],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      defaultIsModuleExports: "auto",
    },
  },
});
