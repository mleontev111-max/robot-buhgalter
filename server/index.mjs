/**
 * Локальный сервер Робота-бухгалтера.
 * Запуск: npm run server  (порт 8787)
 *
 * Сервер принимает API-ключи из приложения и делает read-only запросы
 * к маркетплейсам с сервера (обход браузерного CORS). Ключи нигде
 * не сохраняются — живут только в момент запроса.
 */
import express from 'express'
import cors from 'cors'
import { SYNCERS, TESTERS } from './marketplaces.mjs'

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '1mb' }))

const validate = (body) => {
  const { marketplace, clientId = '', apiKey = '', dateFrom, dateTo } = body ?? {}
  if (!SYNCERS[marketplace]) throw new Error(`Неизвестный маркетплейс: ${marketplace}`)
  if (!apiKey) throw new Error('Не передан API-ключ')
  return { marketplace, clientId, apiKey, dateFrom, dateTo }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'robot-buhgalter-sync' }))

app.post('/api/test', async (req, res) => {
  try {
    const p = validate(req.body)
    await TESTERS[p.marketplace](p)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message ?? e) })
  }
})

app.post('/api/sync', async (req, res) => {
  try {
    const p = validate(req.body)
    if (!p.dateFrom || !p.dateTo) throw new Error('Укажите период dateFrom/dateTo')
    const operations = await SYNCERS[p.marketplace](p)
    res.json({ ok: true, operations, count: operations.length })
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message ?? e) })
  }
})

const port = process.env.PORT ?? 8787
app.listen(port, () => {
  console.log(`Робот-бухгалтер: сервер синхронизации на http://localhost:${port}`)
})
