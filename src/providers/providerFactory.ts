import { MaxProvider } from './MaxProvider'
import { WhatsAppProvider } from './WhatsAppProvider'
import { TelegramProvider } from './TelegramProvider'
import type { GreenApiProvider } from './MessengerProvider'

/**
 * Фабрика для создания экземпляра провайдера по типу мессенджера.
 * Централизует создание и позволяет легко добавлять новые провайдеры.
 * Находится в отдельном файле для избежания циклических зависимостей:
 * - Конкретные провайдеры импортируют GreenApiProvider (базовый класс)
 * - Фабрика импортирует конкретные провайдеры
 *
 * @param type - Тип мессенджера: 'max' | 'whatsapp' | 'telegram'
 * @param apiUrl - Базовый URL инстанса GREEN-API
 * @param idInstance - ID инстанса
 * @param apiTokenInstance - Токен инстанса
 * @returns Экземпляр соответствующего провайдера (GreenApiProvider)
 * @throws Error если передан неизвестный тип
 */
export function createProvider(
  type: 'max' | 'whatsapp' | 'telegram',
  apiUrl: string,
  idInstance: string,
  apiTokenInstance: string,
): GreenApiProvider {
  switch (type) {
    case 'max':
      return new MaxProvider(apiUrl, idInstance, apiTokenInstance)
    case 'whatsapp':
      return new WhatsAppProvider(apiUrl, idInstance, apiTokenInstance)
    case 'telegram':
      return new TelegramProvider(apiUrl, idInstance, apiTokenInstance)
    default: {
      // TypeScript exhaustive check — если добавлен новый тип без обработки, будет ошибка компиляции
      const _exhaustive: never = type
      throw new Error(`Unknown provider type: ${_exhaustive}`)
    }
  }
}
