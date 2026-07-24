import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Component tests render JSX, so esbuild needs the automatic runtime; without
  // it every .tsx test dies with "React is not defined".
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    // Node for the pure logic suites; component tests opt into jsdom with a
    // per-file `@vitest-environment jsdom` docblock.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
