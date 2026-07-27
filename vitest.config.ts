import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

function resolveMaxThreads(): number {
    if (process.env.VITEST_MAX_THREADS) {
        const n = Number(process.env.VITEST_MAX_THREADS);
        if (Number.isFinite(n) && n > 0)
            return Math.floor(n);
    }
    const cpus = typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    if (process.env.CI)
        return Math.max(2, Math.min(4, cpus));
    return Math.max(2, Math.min(cpus, 8));
}

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@app': path.resolve(__dirname, './src/app'),
            '@pages': path.resolve(__dirname, './src/pages'),
            '@widgets': path.resolve(__dirname, './src/widgets'),
            '@features': path.resolve(__dirname, './src/features'),
            '@entities': path.resolve(__dirname, './src/entities'),
            '@shared': path.resolve(__dirname, './src/shared'),
        },
    },
    test: {
        name: 'unit',
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        environment: 'node',
        globals: false,
        pool: 'threads',
        maxWorkers: resolveMaxThreads(),
        fileParallelism: true,
        testTimeout: 10_000,
        coverage: {
            provider: 'v8',
            include: ['src/shared/**/*.ts', 'src/entities/**/*.ts', 'src/pages/time-tracking/ui/timesheet*.ts', 'src/pages/kosta-daily/ui/kostaDaily*.ts'],
            exclude: ['**/*.{test,spec}.{ts,tsx}', '**/index.ts', '**/*.css'],
            thresholds: {
                statements: 15,
                branches: 13,
                functions: 17,
                lines: 15,
            },
        },
    },
});
