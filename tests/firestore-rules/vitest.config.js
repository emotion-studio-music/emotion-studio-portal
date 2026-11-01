import { defineConfig } from 'vitest/config';
// Un solo processo: l'emulatore è condiviso e i test fanno seed/clear.
export default defineConfig({ test: { fileParallelism: false, testTimeout: 20000, hookTimeout: 30000 } });
