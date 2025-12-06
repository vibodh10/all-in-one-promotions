import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],

    // This ensures Vite knows your app lives under /frontend/
    base: "/frontend/",

    // Add this proxy section for local testing & Render environments
    server: {
        proxy: {
            "/api": "http://localhost:3000",
            "/auth": "http://localhost:3000",
            "/debug-session": "http://localhost:3000",
        },
    },

    build: {
        outDir: "dist",
        emptyOutDir: true,
    },
});
