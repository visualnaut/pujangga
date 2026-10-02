import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/daemon/daemon-entry.ts'],
    format: ['esm'],
    target: 'node22',
    outDir: 'dist/daemon',
    clean: true,
    platform: 'node',
    bundle: true,
  },
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    target: 'node22',
    outDir: 'dist/cli',
    clean: true,
    platform: 'node',
    bundle: true,
  },
]);
