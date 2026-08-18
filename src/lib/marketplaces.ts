import type { MarketplaceId } from '@/types'

export interface MarketplaceInfo {
  id: MarketplaceId
  name: string
  color: string
  /** Где взять API-ключи (только чтение) */
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
      'seller.ozon.ru → Настройки → API-ключи',
      'Создайте ключ с типом «Admin read only» (только чтение)',
      'Таким ключом нельзя ничего изменить в кабинете — только читать',
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
      'seller.wildberries.ru → Профиль → Интеграции API',
      'Создайте токен типа «Только чтение» (read-only)',
      'Отметьте категорию «Статистика» — этого достаточно',
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
      'partner.market.yandex.ru → Настройки → API и модули',
      'Создайте Api-Key с доступом «all-methods:read-only» (просмотр всех данных)',
      'Такой ключ не может изменять заказы и товары',
      'Скопируйте Api-Key и CampaignId (идентификатор кабинета там же)',
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
      'Кабинет avito.ru → Настройки → Avito API → Регистрация нового приложения',
      'Скопируйте Client ID и Client Secret',
      'Гранулярного «только чтение» у Авито нет, но наш модуль вызывает только GET-методы заказов',
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
