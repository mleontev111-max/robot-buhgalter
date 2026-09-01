import { defineConfig } from 'vitest/config'

// Отдельный конфиг нужен, чтобы Vitest не поднимался по дереву каталогов
// и не подхватывал корневой vite.config.ts фронтенда (там React-плагин,
// которого в этом изолированном backend-пакете нет и не нужно).
export default defineConfig({
  test: {
    environment: 'node',
  },
})
