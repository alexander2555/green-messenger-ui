import { useState, useCallback, useMemo } from 'react'
import { useConnections } from '../context/ConnectionsContext'
import styles from './ProviderSettingsScreen.module.css'

/** Типы мессенджеров, доступные для выбора */
const MESSENGER_OPTIONS = [
  { value: 'max' as const, label: 'MAX' },
  { value: 'whatsapp' as const, label: 'WhatsApp (soon)' },
  { value: 'telegram' as const, label: 'Telegram (soon)' },
] as const

/** Валидация полей формы */
interface FormErrors {
  apiUrl?: string
  idInstance?: string
  apiTokenInstance?: string
  provider?: string
}

/** Экран управления подключениями к GREEN-API.
 * Позволяет добавлять, удалять, выбирать активное подключение.
 * Сохраняет данные в localStorage через ConnectionsContext.
 */
export function ProviderSettingsScreen() {
  const {
    connections,
    activeConnectionId,
    addConnection,
    removeConnection,
    setActiveConnection,
  } = useConnections()

  // Состояние формы добавления
  const [provider, setProvider] = useState<typeof MESSENGER_OPTIONS[0]['value']>('max')
  const [apiUrl, setApiUrl] = useState('')
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setApiTokenInstance] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** Валидация формы перед отправкой */
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {}

    if (!provider) {
      newErrors.provider = 'Выберите мессенджер'
    }

    if (!apiUrl.trim()) {
      newErrors.apiUrl = 'Введите apiUrl (например, https://3100.api.green-api.com)'
    } else {
      try {
        const url = new URL(apiUrl)
        if (url.protocol !== 'https:') {
          newErrors.apiUrl = 'apiUrl должен использовать HTTPS'
        }
      } catch {
        newErrors.apiUrl = 'Некорректный URL'
      }
    }

    if (!idInstance.trim()) {
      newErrors.idInstance = 'Введите idInstance'
    } else if (!/^\d+$/.test(idInstance)) {
      newErrors.idInstance = 'idInstance должен содержать только цифры'
    }

    if (!apiTokenInstance.trim()) {
      newErrors.apiTokenInstance = 'Введите apiTokenInstance'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [provider, apiUrl, idInstance, apiTokenInstance])

  /** Обработка отправки формы */
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!validateForm()) return

      setIsSubmitting(true)
      try {
        const newId = addConnection({
          provider,
          apiUrl: apiUrl.trim(),
          idInstance: idInstance.trim(),
          apiTokenInstance: apiTokenInstance.trim(),
          name: `${provider.toUpperCase()} (${idInstance.trim().slice(-6)})`,
        })
        // Автоматически делаем новое подключение активным
        setActiveConnection(newId)
        // Сброс формы
        setApiUrl('')
        setIdInstance('')
        setApiTokenInstance('')
        setErrors({})
      } finally {
        setIsSubmitting(false)
      }
    },
    [provider, apiUrl, idInstance, apiTokenInstance, validateForm, addConnection, setActiveConnection],
  )

  /** Удаление подключения с подтверждением */
  const handleRemove = useCallback(
    (id: string) => {
      if (window.confirm('Удалить это подключение?')) {
        removeConnection(id)
      }
    },
    [removeConnection],
  )

  /** Выбор активного подключения */
  const handleSetActive = useCallback(
    (id: string) => {
      setActiveConnection(id)
    },
    [setActiveConnection],
  )

  // Проверка, доступен ли выбранный провайдер (пока только MAX)
  const isProviderAvailable = useMemo(
    () => provider === 'max',
    [provider],
  )

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header} role="banner">
        <h1 className={styles.headerTitle}>Green Messenger</h1>
        <span className={styles.headerTitle} aria-hidden="true" />
      </header>

      {/* Main Content */}
      <main className={styles.main} role="main">
        {/* Add Connection Form */}
        <section className={styles.section} aria-labelledby="add-connection-title">
          <h2 id="add-connection-title" className={styles.sectionTitle}>
            Добавить подключение
          </h2>
          <p className={styles.sectionDescription}>
            Введите учётные данные GREEN-API. Настройте приём уведомлений в личном кабинете
            GREEN-API: <code>webhookUrl</code> пуст, <code>incomingWebhook = yes</code>.
          </p>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {/* Provider Select */}
            <div>
              <label htmlFor="provider" className={styles.label}>
                Мессенджер
              </label>
              <select
                id="provider"
                className={styles.select}
                value={provider}
                onChange={(e) => setProvider(e.target.value as typeof provider)}
                disabled={isSubmitting}
                aria-describedby={errors.provider ? 'provider-error' : undefined}
                aria-invalid={!!errors.provider}
              >
                {MESSENGER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.value !== 'max'}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.provider && (
                <p id="provider-error" className={styles.errorText} role="alert">
                  {errors.provider}
                </p>
              )}
              {!isProviderAvailable && (
                <p className={styles.helperText}>
                  Пока доступен только MAX. WhatsApp и Telegram — в разработке.
                </p>
              )}
            </div>

            {/* apiUrl */}
            <div>
              <label htmlFor="apiUrl" className={styles.label}>
                apiUrl
              </label>
              <input
                id="apiUrl"
                type="url"
                className={`${styles.input} ${errors.apiUrl ? styles.inputError : ''}`}
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://3100.api.green-api.com"
                disabled={isSubmitting}
                aria-describedby={errors.apiUrl ? 'apiurl-error' : 'apiurl-hint'}
                aria-invalid={!!errors.apiUrl}
                autoComplete="off"
              />
              {errors.apiUrl ? (
                <p id="apiurl-error" className={styles.errorText} role="alert">
                  {errors.apiUrl}
                </p>
              ) : (
                <p id="apiurl-hint" className={styles.helperText}>
                  Индивидуальный хост инстанса из личного кабинета GREEN-API
                </p>
              )}
            </div>

            {/* idInstance & apiTokenInstance in row */}
            <div className={styles.formRow}>
              <div>
                <label htmlFor="idInstance" className={styles.label}>
                  idInstance
                </label>
                <input
                  id="idInstance"
                  type="text"
                  className={`${styles.input} ${errors.idInstance ? styles.inputError : ''}`}
                  value={idInstance}
                  onChange={(e) => setIdInstance(e.target.value)}
                  placeholder="310022747717"
                  disabled={isSubmitting}
                  aria-describedby={errors.idInstance ? 'idinstance-error' : 'idinstance-hint'}
                  aria-invalid={!!errors.idInstance}
                  autoComplete="off"
                />
                {errors.idInstance && (
                  <p id="idinstance-error" className={styles.errorText} role="alert">
                    {errors.idInstance}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="apiTokenInstance" className={styles.label}>
                  apiTokenInstance
                </label>
                <input
                  id="apiTokenInstance"
                  type="password"
                  className={`${styles.input} ${errors.apiTokenInstance ? styles.inputError : ''}`}
                  value={apiTokenInstance}
                  onChange={(e) => setApiTokenInstance(e.target.value)}
                  placeholder="544239ffa59f44f0afb0a53a43a4f916..."
                  disabled={isSubmitting}
                  aria-describedby={errors.apiTokenInstance ? 'token-error' : 'token-hint'}
                  aria-invalid={!!errors.apiTokenInstance}
                  autoComplete="off"
                />
                {errors.apiTokenInstance && (
                  <p id="token-error" className={styles.errorText} role="alert">
                    {errors.apiTokenInstance}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={isSubmitting || !isProviderAvailable}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Добавление...' : 'Добавить подключение'}
            </button>
          </form>
        </section>

        {/* Connections List */}
        <section className={styles.section} aria-labelledby="connections-title">
          <h2 id="connections-title" className={styles.sectionTitle}>
            Сохранённые подключения ({connections.length})
          </h2>

          {connections.length === 0 ? (
            <div className={styles.emptyState}>
              <svg
                className={styles.emptyStateIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
                <path d="M12 6V12L16 14" />
              </svg>
              <p className={styles.emptyStateTitle}>Нет подключений</p>
              <p className={styles.emptyStateText}>
                Добавьте первое подключение через форму выше, чтобы начать общение
              </p>
            </div>
          ) : (
            <ul className={styles.connectionsList} role="list">
              {connections.map((conn) => (
                <li
                  key={conn.id}
                  className={`${styles.connectionItem} ${
                    conn.id === activeConnectionId ? styles.connectionItemActive : ''
                  }`}
                >
                  <div className={styles.connectionInfo}>
                    <span className={styles.connectionName}>
                      {conn.name || `${conn.provider.toUpperCase()} (${conn.idInstance.slice(-6)})`}
                    </span>
                    <div className={styles.connectionMeta}>
                      <span className={styles.providerBadge}>
                        {conn.provider.toUpperCase()}
                      </span>
                      <span>ID: {conn.idInstance}</span>
                      <span>API: {conn.apiUrl.replace(/^https?:\/\//, '')}</span>
                    </div>
                  </div>
                  <div className={styles.connectionActions}>
                    {conn.id !== activeConnectionId && (
                      <button
                        className={`${styles.btn} ${styles.btnSecondary} ${styles.btnIcon}`}
                        onClick={() => handleSetActive(conn.id)}
                        aria-label={`Сделать "${conn.name || conn.provider}" активным`}
                        title="Сделать активным"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    )}
                    {conn.id === activeConnectionId && (
                      <span className={styles.providerBadge} style={{ background: 'var(--color-success)', color: 'white' }}>
                        Активно
                      </span>
                    )}
                    <button
                      className={`${styles.btn} ${styles.btnDanger} ${styles.btnIcon}`}
                      onClick={() => handleRemove(conn.id)}
                      aria-label={`Удалить "${conn.name || conn.provider}"`}
                      title="Удалить"
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}