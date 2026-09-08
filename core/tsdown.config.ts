import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/agent/index.ts',
    'src/env-grow/index.ts',
    'src/graph/index.ts',
    'src/web/index.ts',
    'src/canvas/index.ts',
    'src/node/index.ts',
    'src/connect/index.ts',
    'src/sticky/index.ts',
    'src/report/index.ts',
    'src/chat/index.ts',
    'src/human/index.ts',
    'src/bubble/index.ts',
  ],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2022',
  dts: true,
  clean: true,
})
