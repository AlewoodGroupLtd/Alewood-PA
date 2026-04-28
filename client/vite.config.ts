import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Alewood Executive Assistant',
        short_name: 'Moltbot',
        description: 'AI Personal Assistant for Alewood CEO',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: '/ceo-avatar.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})
