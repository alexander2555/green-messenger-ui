import { useState, useCallback, useEffect, useRef } from 'react'
import { useConnections } from '../context/ConnectionsContext'
import { useNotificationsPolling } from '../hooks/useNotificationsPolling'
import type { Connection, Message, CheckAccountResponse } from '../types'
import NewChatBar from './NewChatBar'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import styles from './ChatScreen.module.css'

/** Состояние экрана чата */
type ChatScreenState =
  | { status: 'no-connection' }
  | { status: 'no-chat'; connection: Connection }
  | { status: 'loading'; connection: Connection }
  | {
      status: 'ready'
      connection: Connection
      chatId: string
      phoneNumber: string
    }
  | { status: 'error'; connection: Connection; error: string }

/** Основной экран чата.
 * Управляет состоянием: нет подключения → нет чата → загрузка → готово.
 * Интегрирует поллинг уведомлений, создание чата, отправку сообщений.
 */
export default function ChatScreen() {
  const { activeConnection, activeProvider, setActiveConnection } =
    useConnections()

  // Состояние экрана
  const [screenState, setScreenState] = useState<ChatScreenState>({
    status: 'no-connection',
  })
  // Сообщения текущего чата
  const [messages, setMessages] = useState<Message[]>([])
  // Реф для прокрутки к новым сообщениям
  const messagesEndRef = useRef<HTMLDivElement>(null)

  /** Прокрутка к последнему сообщению */
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Реф для актуального chatId (избегаем зависимость в useCallback)
  const chatIdRef = useRef<string | null>(null)
  const statusRef = useRef<ChatScreenState['status']>('no-connection')

  useEffect(() => {
    chatIdRef.current =
      screenState.status === 'ready' ? screenState.chatId : null
    statusRef.current = screenState.status
  }, [screenState])

  /** Обработка входящего сообщения от поллинга */
  const handleIncomingMessage = useCallback(
    (chatId: string, text: string, timestamp: number) => {
      if (statusRef.current === 'ready' && chatIdRef.current === chatId) {
        const newMessage: Message = {
          id: `incoming-${timestamp}-${Math.random().toString(36).slice(2, 9)}`,
          chatId,
          text,
          direction: 'incoming',
          timestamp,
          status: 'delivered',
        }
        setMessages(prev => [...prev, newMessage])
        scrollToBottom()
      }
    },
    [scrollToBottom],
  )

  // Поллинг уведомлений
  const { stop, start } = useNotificationsPolling({
    provider: activeProvider,
    onIncomingMessage: handleIncomingMessage,
    enabled: screenState.status === 'ready',
  })

  // Эффект: синхронизация состояния при смене активного подключения
  useEffect(() => {
    if (!activeConnection) {
      setScreenState({ status: 'no-connection' })
      return
    }
    // Сброс к выбору чата при смене подключения
    setScreenState({ status: 'no-chat', connection: activeConnection })
    setMessages([])
  }, [activeConnection])

  // Эффект: управление поллингом
  useEffect(() => {
    if (screenState.status === 'ready') {
      start()
    } else {
      stop()
    }
    return () => stop()
  }, [screenState.status, start, stop])

  /** Создание нового чата через CheckAccount */
  const handleCreateChat = useCallback(
    async (phoneNumber: string) => {
      if (!activeProvider || !activeConnection) return

      setScreenState(prev =>
        prev.status === 'no-chat' || prev.status === 'ready'
          ? { status: 'loading', connection: activeConnection }
          : prev,
      )

      try {
        const response: CheckAccountResponse =
          await activeProvider.checkAccount({
            phoneNumber,
            force: true,
          })

        if (!response.exist) {
          const providerName = activeConnection?.provider.toUpperCase() ?? 'MAX'
          throw new Error(
            `Аккаунт не найден в ${providerName}. Проверьте номер телефона.`,
          )
        }

        // Успех — переходим в режим чата
        setScreenState({
          status: 'ready',
          connection: activeConnection,
          chatId: response.chatId,
          phoneNumber,
        })
        setMessages([])
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Ошибка создания чата'
        setScreenState({
          status: 'error',
          connection: activeConnection,
          error: errorMessage,
        })
      }
    },
    [activeProvider, activeConnection],
  )

  /** Повторная попытка после ошибки */
  const handleRetry = useCallback(() => {
    if (activeConnection) {
      setScreenState({ status: 'no-chat', connection: activeConnection })
    }
  }, [activeConnection])

  /** Отправка сообщения */
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!activeProvider || screenState.status !== 'ready') return
      const chatId = screenState.chatId

      const tempId = `outgoing-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const optimisticMessage: Message = {
        id: tempId,
        chatId,
        text,
        direction: 'outgoing',
        timestamp: Date.now(),
        status: 'sending',
      }

      // Оптимистичное добавление
      setMessages(prev => [...prev, optimisticMessage])
      scrollToBottom()

      try {
        const response = await activeProvider.sendMessage({
          chatId,
          message: text,
        })

        // Замена временного ID на реальный
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId
              ? { ...m, id: response.idMessage, status: 'sent' as const }
              : m,
          ),
        )
      } catch (error) {
        // Помечаем ошибку, оставляем сообщение в списке
        setMessages(prev =>
          prev.map(m =>
            m.id === tempId ? { ...m, status: 'error' as const } : m,
          ),
        )
        console.error('Send message error:', error)
      }
    },
    [activeProvider, screenState],
  )

  // Рендер состояний
  if (screenState.status === 'no-connection') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.chatName}>Green Messenger</h1>
          </div>
        </header>
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyStateIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
          <p className={styles.emptyStateTitle}>Нет активного подключения</p>
          <p className={styles.emptyStateText}>
            Перейдите в настройки, чтобы добавить и выбрать подключение к
            GREEN-API
          </p>
        </div>
      </div>
    )
  }

  if (screenState.status === 'no-chat') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.chatName}>Green Messenger</h1>
          </div>
          <div className={styles.headerRight}>
            <button
              className={styles.iconBtn}
              onClick={() => setActiveConnection(null)}
              aria-label="Настройки подключений"
              title="Настройки"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 21.47a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </div>
        </header>
        <div className={styles.messagesArea}>
          <NewChatBar
            onCreateChat={handleCreateChat}
            provider={activeConnection?.provider ?? 'max'}
          />
        </div>
      </div>
    )
  }

  if (screenState.status === 'loading') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.chatName}>Green Messenger</h1>
          </div>
        </header>
        <div className={styles.loading}>
          <div className={styles.spinner} aria-label="Создание чата" />
        </div>
      </div>
    )
  }

  if (screenState.status === 'error') {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              className={styles.backBtn}
              onClick={handleRetry}
              aria-label="Назад к выбору чата"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <h1 className={styles.chatName}>Ошибка</h1>
          </div>
        </header>
        <div className={styles.errorState}>
          <svg
            className={styles.errorIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p>{screenState.error}</p>
          <button
            className={`${styles.btnPrimary} ${styles.retryBtn}`}
            onClick={handleRetry}
          >
            Попробовать снова
          </button>
        </div>
      </div>
    )
  }

  // status === 'ready'
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backBtn}
            onClick={() =>
              setScreenState({
                status: 'no-chat',
                connection: screenState.connection,
              })
            }
            aria-label="Назад к списку чатов"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div className={styles.chatInfo}>
            <span className={styles.chatName}>
              {screenState.phoneNumber.replace(
                /(\d{3})(\d{3})(\d{2})(\d{2})/,
                '+$1 ($2) $3-$4',
              )}
            </span>
            <span className={styles.chatStatus}>
              {screenState.connection.provider.toUpperCase()} ·{' '}
              {screenState.connection.idInstance.slice(-6)}
            </span>
          </div>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.iconBtn}
            aria-label="Информация о чате"
            title="Инфо"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
          <button
            className={styles.iconBtn}
            aria-label="Меню чата"
            title="Меню"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="1" />
              <circle cx="19" cy="12" r="1" />
              <circle cx="5" cy="12" r="1" />
            </svg>
          </button>
        </div>
      </header>

      <div
        className={styles.messagesArea}
        role="log"
        aria-live="polite"
        aria-label="Сообщения"
      >
        <MessageList messages={messages} />
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <MessageInput onSend={handleSendMessage} disabled={false} />
      </div>
    </div>
  )
}
