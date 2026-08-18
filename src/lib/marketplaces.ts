import type { MarketplaceId } from '@/types'

export interface MarketplaceInfo {
  id: MarketplaceId
  name: string
  color: string
  /** Где взять API-ключи */
  keyHelp: string[]
  keyUrl: string
  /** Какие поля нужны для API */
  fields: { clientId: string; apiKey: string }
  /** Какой отчёт выгружать для импорта */
  reportHelp: string
}

export const MARKETPLACES: MarketplaceInfo[] = [
  {
    id: 'ozon',
    name: 'Ozon',
    color: '#005BFF',
    keyHelp: [
      'Зайдите в кабинет продавца seller.ozon.ru',
      'Настройки → API-ключи',
      'Создайте ключ: роль «Отчёты и аналитика» (или Admin)',
      'Скопируйте Client-Id и Api-Key',
    ],
    keyUrl: 'https://seller.ozon.ru/app/settings/api-keys',
    fields: { clientId: 'Client-Id', apiKey: 'Api-Key' },
    reportHelp:
      'seller.ozon.ru → Финансы → Отчёты → «Отчёт о реализации» (CSV или XLSX) за нужный месяц.',
  },
  {
    id: 'wb',
    name: 'Wildberries',
    color: '#CB11AB',
    keyHelp: [
      'Зайдите в кабинет seller.wildberries.ru',
      'Настройки → Доступ к API',
      'Создайте токен с доступом «Статистика» и «Аналитика»',
      'Скопируйте токен (показывается один раз)',
    ],
    keyUrl: 'https://seller.wildberries.ru/supplier-settings/access-to-api',
    fields: { clientId: '', apiKey: 'Токен API' },
    reportHelp:
      'seller.wildberries.ru → Аналитика → Отчёты → «Детализация еженедельного отчёта» (XLSX).',
  },
  {
    id: 'yandex',
    name: 'Яндекс Маркет',
    color: '#FC3F1D',
    keyHelp: [
      'Зайдите в partner.market.yandex.ru',
      'Настройки → API-ключи → «Авторизационный токен»',
      'Создайте токен для API Партнёрского интерфейса',
      'Скопируйте Api-Key и номер кабинета (campaignId)',
    ],
    keyUrl: 'https://partner.market.yandex.ru/',
    fields: { clientId: 'CampaignId', apiKey: 'Api-Key' },
    reportHelp:
      'partner.market.yandex.ru → Отчёты → «Отчёт по реализации» или выгрузка заказов (XLSX/CSV).',
  },
  {
    id: 'avito',
    name: 'Авито',
    color: '#0AF',
    keyHelp: [
      'Зайдите в кабинет avito.ru → «Авито Pro» / API для бизнеса',
      'Создайте приложение на developers.avito.ru',
      'Скопируйте Client ID и Client Secret',
    ],
    keyUrl: 'https://developers.avito.ru/',
    fields: { clientId: 'Client ID', apiKey: 'Client Secret' },
    reportHelp:
      'avito.ru → кабинет магазина → «Заказы» → выгрузить (XLSX/CSV).',
  },
]

export const mpInfo = (id: MarketplaceId): MarketplaceInfo =>
  MARKETPLACES.find((m) => m.id === id) ?? MARKETPLACES[0]

export const mpName = (id: MarketplaceId): string => mpInfo(id).name
