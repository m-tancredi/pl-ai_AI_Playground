import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Default Vite dev port
    // Optional: Proxy API requests during development to avoid CORS issues
    // if you run frontend and backend separately without Docker/Nginx
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:8000', // Your Django backend address
    //     changeOrigin: true,
    //     // rewrite: (path) => path.replace(/^\/api/, '/api/v1') // Adjust if needed
    //   }
    // }
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  }
})