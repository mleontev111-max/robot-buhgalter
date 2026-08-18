import type { AppState, MarketplaceId, Operation } from '@/types'

const uid = () => Math.random().toString(36).slice(2, 10)

const PRODUCTS = [
  'Пуэр Шу, блин 357 г',
  'Те Гуань Инь, 100 г',
  'Да Хун Пао, 50 г',
  'Габа Алишань, 100 г',
  'Белый чай Шоу Мэй, 100 г',
  'Чайная пара фарфор',
  'Гайвань 120 мл',
  'Чабань «Бамбук»',
  'Матча церемониальная, 50 г',
  'Травяной сбор «Иван-чай», 100 г',
]

/** Демо-данные: ~6 месяцев продаж двух чайных магазинов */
export function makeDemoState(): AppState {
  const stores = [
    {
      id: 'lafka',
      name: 'Чайная лафка',
      regime: 'usn6' as const,
      insurancePremiums: 53658,
      hasEmployees: false,
    },
    {
      id: 'thechai',
      name: 'the chai',
      regime: 'usn15' as const,
      insurancePremiums: 53658,
      hasEmployees: true,
    },
  ]

  const mps: MarketplaceId[] = ['ozon', 'wb', 'yandex', 'avito']
  const ops: Operation[] = []
  const now = new Date()

  for (const store of stores) {
    const scale = store.id === 'lafka' ? 1 : 0.7
    for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
      const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
      const opsCount = 18 + Math.floor(Math.random() * 14)
      for (let i = 0; i < opsCount; i++) {
        const mp = mps[Math.floor(Math.random() * mps.length)]
        const day = 1 + Math.floor(Math.random() * daysInMonth)
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        if (date > now.toISOString().slice(0, 10)) continue
        const revenue = Math.round((400 + Math.random() * 4200) * scale)
        const commission = Math.round(revenue * (mp === 'avito' ? 0.05 : 0.08 + Math.random() * 0.12))
        const logistics = mp === 'avito' ? 0 : Math.round(40 + Math.random() * 220)
        const ads = Math.random() < 0.4 ? Math.round(revenue * (0.03 + Math.random() * 0.07)) : 0
        const otherExpenses = Math.random() < 0.12 ? Math.round(50 + Math.random() * 300) : 0
        ops.push({
          id: uid(),
          storeId: store.id,
          marketplace: mp,
          date,
          revenue,
          commission,
          logistics,
          ads,
          otherExpenses,
          note: PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)],
        })
      }
    }
  }

  ops.sort((a, b) => b.date.localeCompare(a.date))
  return { stores, operations: ops, credentials: [] }
}
