import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // jsPDF's optional HTML/SVG renderers; FarmLink only draws tables, so they are not bundled.
      external: ['canvg', 'html2canvas', 'dompurify'],
    },
  },
  css: {
    preprocessorOptions: {
      // Bootstrap 5.3 still uses Sass APIs that newer Sass versions warn about.
      scss: { silenceDeprecations: ['mixed-decls', 'color-functions', 'global-builtin', 'import'] },
    },
  },
})
