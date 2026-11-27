import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: './',
    plugins: [react()],
    worker: { format: 'es' },
    build: {
        target: 'es2022',
        chunkSizeWarningLimit: 1500,
    },
    test: {
        include: ['src/**/*.test.ts'],
    },
});
