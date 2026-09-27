import { GreenApiProvider } from './MessengerProvider'
import type {
  SendMessageRequest,
  SendMessageResponse,
  CheckAccountRequest,
  CheckAccountTelegramResponse,
} from '../types'

/**
 * Провайдер для мессенджера Telegram через GREEN-API.
 * Реализует конкретные методы API для Telegram:
 * - sendMessage: отправка текстового сообщения
 * - checkAccount: проверка номера телефона (любой международный формат E.164)
 * Наследует long polling логику от GreenApiProvider.
 */
export class TelegramProvider extends GreenApiProvider {
  /** Идентификатор провайдера — 'telegram' */
  readonly id = 'telegram' as const

  /**
   * @param apiUrl - Базовый URL инстанса GREEN-API (например, https://3100.api.green-api.com)
   * @param idInstance - ID инстанса
   * @param apiTokenInstance - Токен инстанса
   */
  constructor(apiUrl: string, idInstance: string, apiTokenInstance: string) {
    super(apiUrl, idInstance, apiTokenInstance)
  }

  /**
   * Отправка текстового сообщения в Telegram.
   * Вызывает POST /sendMessage/ с параметрами chatId, message, typingTime, quotedMessageId.
   *
   * @param request - Параметры сообщения
   * @returns Promise с idMessage отправленного сообщения
   * @throws Error при ошибке API (лимиты, неверный chatId, и т.д.)
   */
  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    return this.request<SendMessageResponse>('POST', '/sendMessage/', {
      chatId: request.chatId,
      message: request.message,
      typingTime: request.typingTime,
      quotedMessageId: request.quotedMessageId,
    })
  }

  /**
   * Проверка существования аккаунта в Telegram по номеру телефона или username.
   * Вызывает POST /checkAccount/.
   * Поддерживает два режима:
   * - phoneNumber: integer в международном формате без + (например, 79001234567)
   * - username: string, начинающийся с @ (например, @username)
   * Только один из параметров должен быть передан.
   *
   * @param request - phoneNumber (integer) ИЛИ username (string, начинается с @), опционально force=true
   * @returns Promise с результатом: { exist, chatId, username?, phoneNumber?, fromCache }
   * @throws Error при ошибке API
   */
  async checkAccount(
    request: CheckAccountRequest,
  ): Promise<CheckAccountTelegramResponse> {
    const body: Record<string, unknown> = {}

    if (request.phoneNumber !== undefined) {
      // Для Telegram phoneNumber должен быть integer
      body.phoneNumber =
        typeof request.phoneNumber === 'string'
          ? parseInt(request.phoneNumber, 10)
          : request.phoneNumber
    } else if (request.username !== undefined) {
      body.username = request.username
    }

    if (request.force !== undefined) {
      body.force = request.force
    }

    return this.request<CheckAccountTelegramResponse>(
      'POST',
      '/checkAccount/',
      body,
    )
  }
}
