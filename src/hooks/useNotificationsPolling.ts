import { useEffect, useRef, useCallback } from 'react'
import type { MessengerProvider } from '../providers/MessengerProvider'

/**
 * Опции хука useNotificationsPolling.
 */
interface UseNotificationsPollingOptions {
  /** Провайдер мессенджера (null = поллинг отключён) */
  provider: MessengerProvider | null
  /**
   * Callback для входящих текстовых сообщений.
   * Вызывается с (chatId, text, timestampMs)
   */
  onIncomingMessage: (chatId: string, text: string, timestamp: number) => void
  /** Явное включение/выключение поллинга (по умолчанию true) */
  enabled?: boolean
}

/**
 * Хук для управления long polling уведомлений от GREEN-API.
 *
 * Инкапсулирует жизненный цикл поллинга:
 * - Запуск при появлении провайдера и enabled=true
 * - Остановка при размонтировании, смене провайдера или enabled=false
 * - Предоставляет ручные методы start/stop для внешнего управления
 *
 * @param options - Конфигурация поллинга
 * @returns Объект с методами { stop, start }
 */
export function useNotificationsPolling({
  provider,
  onIncomingMessage,
  enabled = true,
}: UseNotificationsPollingOptions) {
  // Реф для функции остановки текущего поллинга
  const stopPollingRef = useRef<(() => void) | null>(null)
  // Рефы для актуальных значений без ретриггеров эффекта
  const enabledRef = useRef(enabled)
  const onIncomingMessageRef = useRef(onIncomingMessage)

  // Синхронизируем enabledRef
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  // Синхронизируем callback реф
  useEffect(() => {
    onIncomingMessageRef.current = onIncomingMessage
  }, [onIncomingMessage])

  /**
   * Основной эффект: управление жизненным циклом поллинга.
   * Запускает поллинг когда есть провайдер и enabled=true.
   * Останавливает при cleanup или изменении провайдера.
   */
  useEffect(() => {
    // Условия для остановки: нет провайдера или поллинг отключён
    if (!provider || !enabledRef.current) {
      if (stopPollingRef.current) {
        stopPollingRef.current()
        stopPollingRef.current = null
      }
      return
    }

    // Запускаем поллинг через провайдер
    stopPollingRef.current = provider.pollNotifications((chatId, text, timestamp) => {
      // Вызываем callback только если поллинг всё ещё включён
      if (enabledRef.current) {
        onIncomingMessageRef.current(chatId, text, timestamp)
      }
    })

    // Cleanup: останавливаем поллинг при размонтировании или смене провайдера
    return () => {
      if (stopPollingRef.current) {
        stopPollingRef.current()
        stopPollingRef.current = null
      }
    }
  }, [provider])

  /**
   * Ручная остановка поллинга.
   * Полезно для временной паузы (например, при уходе со вкладки чата).
   */
  const stop = useCallback(() => {
    if (stopPollingRef.current) {
      stopPollingRef.current()
      stopPollingRef.current = null
    }
  }, [])

  /**
   * Ручной запуск поллинга.
   * Полезно для возобновления после stop() или смены enabled.
   */
  const start = useCallback(() => {
    if (provider && !stopPollingRef.current && enabledRef.current) {
      stopPollingRef.current = provider.pollNotifications((chatId, text, timestamp) => {
        onIncomingMessageRef.current(chatId, text, timestamp)
      })
    }
  }, [provider])

  return { stop, start }
}