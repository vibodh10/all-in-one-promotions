import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    base: './',
    optimizeDeps: {
        include: [
            '@shopify/app-bridge-react',
            '@shopify/app-bridge',
            '@shopify/app-bridge-utils',
            '@shopify/app-bridge/actions'
        ],
    },
    build: {
        commonjsOptions: {
            include: [/app-bridge/, /node_modules/],
        },
        outDir: 'dist',
    },
});
