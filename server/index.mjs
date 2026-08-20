/**
 * Локальный read-only сервер синхронизации Робота-бухгалтера.
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

const SOURCE_MODE = {
  ozon: { sourceMode: 'financial', complete: true },
  wb: { sourceMode: 'financial', complete: true },
  yandex: { sourceMode: 'orders', complete: false, warning: 'Сейчас используется API заказов. Для бухгалтерского контура добавляется комплект финансовых отчётов Яндекс Маркета.' },
  avito: { sourceMode: 'orders', complete: false, warning: 'Полнота финансовых данных зависит от возможностей конкретного кабинета Авито.' },
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'robot-buhgalter-sync' }))
app.get('/api/capabilities', (_req, res) => res.json({ ok: true, marketplaces: SOURCE_MODE }))

app.post('/api/test', async (req, res) => {
  try {
    const p = validate(req.body)
    await TESTERS[p.marketplace](p)
    res.json({ ok: true, capability: SOURCE_MODE[p.marketplace] })
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message ?? e) })
  }
})

app.post('/api/sync', async (req, res) => {
  try {
    const p = validate(req.body)
    if (!p.dateFrom || !p.dateTo) throw new Error('Укажите период dateFrom/dateTo')
    const operations = await SYNCERS[p.marketplace](p)
    const capability = SOURCE_MODE[p.marketplace] ?? { sourceMode: 'fallback', complete: false }
    res.json({
      ok: true,
      operations,
      count: operations.length,
      coverage: {
        dateFrom: p.dateFrom,
        dateTo: p.dateTo,
        operationCount: operations.length,
        ...capability,
      },
    })
  } catch (e) {
    res.status(400).json({ ok: false, error: String(e.message ?? e) })
  }
})

const port = process.env.PORT ?? 8787
app.listen(port, () => console.log(`Робот-бухгалтер: сервер синхронизации на http://localhost:${port}`))
