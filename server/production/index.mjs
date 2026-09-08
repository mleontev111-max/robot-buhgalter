import { createProductionApp } from './app.mjs'
import { getPool } from './db.mjs'
import { parseEncryptionKey } from './security.mjs'

const port = Number(process.env.PORT ?? 8788)

parseEncryptionKey()
await getPool()

createProductionApp().listen(port, () => {
  console.log(`Robot-Buhgalter production API listening on port ${port}`)
})
