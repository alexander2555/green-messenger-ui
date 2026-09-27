import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import type { Connection } from '../types'
import { createProvider } from '../providers/providerFactory'

/**
 * Значение контекста подключений.
 * Предоставляет состояние списка подключений, активного подключения
 * и методы для управления ими.
 */
interface ConnectionsContextValue {
  /** Список всех сохранённых подключений */
  connections: Connection[]
  /** ID активного подключения (null если не выбран) */
  activeConnectionId: string | null
  /** Активное подключение или null */
  activeConnection: Connection | null
  /** Экземпляр провайдера для активного подключения или null */
  activeProvider: ReturnType<typeof createProvider> | null
  /** Добавить новое подключение, вернуть его ID */
  addConnection: (connection: Omit<Connection, 'id'>) => string
  /** Удалить подключение по ID */
  removeConnection: (id: string) => void
  /** Установить активное подключение по ID (null = сбросить) */
  setActiveConnection: (id: string | null) => void
  /** Частично обновить подключение */
  updateConnection: (id: string, updates: Partial<Connection>) => void
}

/** Контекст для хранения и предоставления состояния подключений */
const ConnectionsContext = createContext<ConnectionsContextValue | null>(null)

/** Ключ localStorage для списка подключений */
const STORAGE_KEY = 'green-messenger-connections'
/** Ключ localStorage для ID активного подключения */
const ACTIVE_STORAGE_KEY = 'green-messenger-active-connection'

/**
 * Провайдер контекста подключений.
 * Управляет списком подключений в localStorage и предоставляет
 * активный провайдер для использования в компонентах чата.
 *
 * @param children - Дочерние компоненты
 */
export function ConnectionsProvider({ children }: { children: ReactNode }) {
  // Инициализация состояния из localStorage
  const [connections, setConnections] = useState<Connection[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored) as Connection[]
      }
    } catch {
      // Игнорируем ошибки парсинга, возвращаем пустой массив
    }
    return []
  })

  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    () => {
      try {
        const stored = localStorage.getItem(ACTIVE_STORAGE_KEY)
        if (stored) {
          return stored
        }
      } catch {
        // Игнорируем ошибки чтения
      }
      return null
    },
  )

  // Сохраняем connections в localStorage при изменении
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(connections))
  }, [connections])

  // Сохраняем activeConnectionId в localStorage при изменении
  useEffect(() => {
    if (activeConnectionId) {
      localStorage.setItem(ACTIVE_STORAGE_KEY, activeConnectionId)
    } else {
      localStorage.removeItem(ACTIVE_STORAGE_KEY)
    }
  }, [activeConnectionId])

  /**
   * Добавляет новое подключение в список.
   * Генерирует уникальный ID через crypto.randomUUID().
   */
  const addConnection = useCallback(
    (connection: Omit<Connection, 'id'>): string => {
      const id = crypto.randomUUID()
      const newConnection: Connection = { ...connection, id }
      setConnections(prev => [...prev, newConnection])
      return id
    },
    [],
  )

  /**
   * Удаляет подключение по ID.
   * Если удаляемое подключение было активным — сбрасываем активное.
   */
  const removeConnection = useCallback(
    (id: string) => {
      setConnections(prev => prev.filter(c => c.id !== id))
      if (activeConnectionId === id) {
        setActiveConnectionId(null)
      }
    },
    [activeConnectionId],
  )

  /** Устанавливает активное подключение (или null для сброса) */
  const setActiveConnection = useCallback((id: string | null) => {
    setActiveConnectionId(id)
  }, [])

  /** Частично обновляет поля подключения */
  const updateConnection = useCallback(
    (id: string, updates: Partial<Connection>) => {
      setConnections(prev =>
        prev.map(c => (c.id === id ? { ...c, ...updates } : c)),
      )
    },
    [],
  )

  // Находим активное подключение по ID
  const activeConnection =
    connections.find(c => c.id === activeConnectionId) ?? null

  // Создаём провайдер для активного подключения (если есть)
  // useMemo предотвращает пересоздание провайдера на каждом рендере
  const activeProvider = useMemo(() => {
    if (!activeConnection) return null
    return createProvider(
      activeConnection.provider,
      activeConnection.apiUrl,
      activeConnection.idInstance,
      activeConnection.apiTokenInstance,
    )
  }, [activeConnection])

  const value: ConnectionsContextValue = {
    connections,
    activeConnectionId,
    activeConnection,
    activeProvider,
    addConnection,
    removeConnection,
    setActiveConnection,
    updateConnection,
  }

  return (
    <ConnectionsContext.Provider value={value}>
      {children}
    </ConnectionsContext.Provider>
  )
}

/**
 * Хук для доступа к контексту подключений.
 * Выбрасывает ошибку, если используется вне ConnectionsProvider.
 */
export function useConnections() {
  const context = useContext(ConnectionsContext)
  if (!context) {
    throw new Error('useConnections must be used within ConnectionsProvider')
  }
  return context
}
