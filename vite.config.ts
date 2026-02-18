import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const mode = process.env.BUILD_TARGET || 'popup'

const aliases = {
  '@shared': resolve(__dirname, 'src/shared'),
  '@popup': resolve(__dirname, 'src/popup'),
  '@content': resolve(__dirname, 'src/content'),
}

const configs: Record<string, ReturnType<typeof defineConfig>> = {
  popup: defineConfig({
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          { src: 'public/manifest.json', dest: '.' },
          { src: 'public/icons/*', dest: 'icons' },
        ],
      }),
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'popup.html'),
        },
      },
    },
    resolve: { alias: aliases },
  }),

  content: defineConfig({
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      copyPublicDir: false,
      rollupOptions: {
        input: resolve(__dirname, 'src/content/main.tsx'),
        output: {
          format: 'iife',
          entryFileNames: 'content.js',
          inlineDynamicImports: true,
        },
      },
    },
    resolve: { alias: aliases },
  }),

  background: defineConfig({
    plugins: [],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      copyPublicDir: false,
      rollupOptions: {
        input: resolve(__dirname, 'src/background/index.ts'),
        output: {
          format: 'iife',
          entryFileNames: 'background.js',
          inlineDynamicImports: true,
        },
      },
    },
    resolve: { alias: aliases },
  }),
}

export default configs[mode]
