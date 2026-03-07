import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  // Build settings for CSP compliance
  build: {
    // Use terser for minification (no eval)
    minify: 'terser',
    terserOptions: {
      compress: {
        // Avoid eval-like constructs
        evaluate: false,
      },
    },
    // Avoid inline scripts that might trigger CSP
    cssCodeSplit: true,
  },

  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})
