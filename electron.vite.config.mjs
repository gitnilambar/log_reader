import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    entry: 'src/main/index.ts'
  },
  preload: {
    entry: 'src/preload/index.ts'
  },
  renderer: {
    input: 'src/renderer/index.html'
  }
})
