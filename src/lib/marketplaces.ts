import type { MarketplaceId } from '@/types'

export interface FinancialReportRequirement {
  id: string
  name: string
  purpose: 'tax_revenue' | 'returns' | 'fees' | 'payouts' | 'documents'
  requiredForTax: boolean
  status: 'api' | 'fallback_file' | 'limited'
  note: string
}

export interface MarketplaceInfo {
  id: MarketplaceId
  name: string
  color: string
  keyHelp: string[]
  keyUrl: string
  fields: { clientId: string; apiKey: string }
  reportHelp: string
  financialReports: FinancialReportRequirement[]
}

export const MARKETPLACES: MarketplaceInfo[] = [
  {
    id: 'ozon',
    name: 'Ozon',
    color: '#005BFF',
    keyHelp: [
      'seller.ozon.ru → Настройки → API-ключи',
      'Создайте отдельный ключ только на чтение для каждого кабинета Ozon',
      'Каждый Client-Id сохраняется как отдельный канал продаж внутри одного ИП',
      'Скопируйте Client-Id и Api-Key',
    ],
    keyUrl: 'https://seller.ozon.ru/app/settings/api-keys',
    fields: { clientId: 'Client-Id', apiKey: 'Api-Key' },
    reportHelp: 'Финансовые операции Seller API + отчет о реализации для контрольной сверки.',
    financialReports: [
      { id: 'transactions', name: 'Финансовые операции', purpose: 'tax_revenue', requiredForTax: true, status: 'api', note: 'Продажи, возвраты, комиссии, логистика и удержания по кабинету.' },
      { id: 'realization', name: 'Отчет о реализации', purpose: 'documents', requiredForTax: true, status: 'fallback_file', note: 'Используется как контрольный документ и резервный источник.' },
      { id: 'payouts', name: 'Выплаты', purpose: 'payouts', requiredForTax: false, status: 'api', note: 'Нужны для сверки с банком, но не заменяют налоговую выручку.' },
    ],
  },
  {
    id: 'wb',
    name: 'Wildberries',
    color: '#CB11AB',
    keyHelp: [
      'seller.wildberries.ru → Профиль → Интеграции API',
      'Создайте токен только на чтение',
      'Для бухгалтерского контура нужны права на финансовые отчёты/статистику',
      'Скопируйте токен (показывается один раз)',
    ],
    keyUrl: 'https://seller.wildberries.ru/supplier-settings/access-to-api',
    fields: { clientId: '', apiKey: 'Токен API' },
    reportHelp: 'Детализация отчетов реализации + финансовые удержания и документы.',
    financialReports: [
      { id: 'sales-report', name: 'Детализация отчёта реализации', purpose: 'tax_revenue', requiredForTax: true, status: 'api', note: 'Главный источник продаж, возвратов и удержаний WB.' },
      { id: 'acquiring', name: 'Эквайринговые издержки', purpose: 'fees', requiredForTax: false, status: 'api', note: 'Для точного разложения расходов и сверки.' },
      { id: 'documents', name: 'Бухгалтерские документы', purpose: 'documents', requiredForTax: false, status: 'api', note: 'Акты, УПД/УКД и другие документы для архива.' },
    ],
  },
  {
    id: 'yandex',
    name: 'Яндекс Маркет',
    color: '#FC3F1D',
    keyHelp: [
      'partner.market.yandex.ru → Настройки → API и модули',
      'Создайте API-Key с правом finance-and-accounting или all-methods:read-only',
      'Скопируйте Api-Key и CampaignId',
      'Для нескольких кабинетов создавайте отдельные каналы продаж',
    ],
    keyUrl: 'https://partner.market.yandex.ru/',
    fields: { clientId: 'CampaignId', apiKey: 'Api-Key' },
    reportHelp: 'Робот должен собирать комплект финансовых отчетов, а не только список заказов.',
    financialReports: [
      { id: 'goods-realization', name: 'Отчёт по реализации', purpose: 'tax_revenue', requiredForTax: true, status: 'api', note: 'Основной документ для реализации.' },
      { id: 'united-returns', name: 'Невыкупы и возвраты', purpose: 'returns', requiredForTax: true, status: 'api', note: 'Нужен для корректировки выручки.' },
      { id: 'marketplace-services', name: 'Стоимость услуг Маркета', purpose: 'fees', requiredForTax: false, status: 'api', note: 'Комиссии и услуги.' },
      { id: 'united-netting', name: 'Платежи', purpose: 'payouts', requiredForTax: false, status: 'api', note: 'Сверка выплат с банковским счётом.' },
    ],
  },
  {
    id: 'avito',
    name: 'Авито',
    color: '#0AF',
    keyHelp: [
      'Кабинет Avito → API / приложение',
      'Скопируйте Client ID и Client Secret',
      'Доступность заказов и финансовых данных зависит от типа кабинета',
      'Если финансовые данные недоступны через API, используем выгрузку из кабинета + банк',
    ],
    keyUrl: 'https://developers.avito.ru/',
    fields: { clientId: 'Client ID', apiKey: 'Client Secret' },
    reportHelp: 'API заказов используется при наличии доступа; финансовый отчет может потребовать файловую выгрузку.',
    financialReports: [
      { id: 'orders', name: 'Заказы/сделки', purpose: 'tax_revenue', requiredForTax: true, status: 'limited', note: 'Доступ зависит от тарифа и типа кабинета.' },
      { id: 'financial-export', name: 'Финансовая выгрузка кабинета', purpose: 'documents', requiredForTax: true, status: 'fallback_file', note: 'Резервный источник, если API не содержит полной финансовой информации.' },
      { id: 'bank-reconciliation', name: 'Сверка поступлений', purpose: 'payouts', requiredForTax: false, status: 'fallback_file', note: 'Проверяем по банковской выписке, не используем выплату как замену выручки.' },
    ],
  },
]

export const mpInfo = (id: MarketplaceId): MarketplaceInfo => MARKETPLACES.find((m) => m.id === id) ?? MARKETPLACES[0]
export const mpName = (id: MarketplaceId): string => mpInfo(id).name
