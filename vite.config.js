import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      // Bootstrap 5.3 still uses Sass APIs that newer Sass versions warn about.
      scss: { silenceDeprecations: ['mixed-decls', 'color-functions', 'global-builtin', 'import'] },
    },
  },
})
