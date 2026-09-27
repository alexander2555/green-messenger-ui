import React, { useState, useCallback, type FormEvent } from 'react'
import styles from './NewChatBar.module.css'

/** Props для NewChatBar */
interface NewChatBarProps {
  /** Callback при создании чата: (identifier) => void
   * Для Telegram identifier может быть телефоном (только цифры) или username (начинается с @) */
  onCreateChat: (identifier: string) => void
  /** Тип провайдера для валидации ввода */
  provider: 'max' | 'whatsapp' | 'telegram'
}

/** Компонент для ввода номера телефона/username и создания нового чата.
 * Валидирует формат в зависимости от провайдера.
 * Для Telegram: телефон (начинается с +) ИЛИ username (начинается с @)
 */
export default function NewChatBar({
  onCreateChat,
  provider,
}: NewChatBarProps) {
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** Валидация ввода в зависимости от провайдера */
  const validateInput = useCallback(
    (value: string): string | null => {
      const trimmed = value.trim()

      if (!trimmed) {
        return provider === 'telegram'
          ? 'Введите номер телефона (начинается с +) или username (начинается с @)'
          : 'Введите номер телефона'
      }

      if (provider === 'max') {
        // MAX: только телефон, формат E.164 (цифры с кодом страны)
        const cleaned = trimmed.replace(/\D/g, '')
        if (!cleaned) {
          return 'Введите номер телефона'
        }
        if (cleaned.startsWith('7')) {
          if (cleaned.length !== 11) {
            return 'Номер России должен содержать 11 цифр (7XXXXXXXXXX)'
          }
          return null
        }
        if (cleaned.startsWith('375')) {
          if (cleaned.length !== 12) {
            return 'Номер Беларуси должен содержать 12 цифр (375XXXXXXXXX)'
          }
          return null
        }
        return 'Для MAX поддерживаются только номера России (+7) и Беларуси (+375)'
      }

      if (provider === 'telegram') {
        // Telegram: телефон (+7XXXXXXXXXX) ИЛИ username (@username)
        if (trimmed.startsWith('@')) {
          // Валидация username: @ + alphanumeric/underscore, 5-32 символа после @
          const username = trimmed.slice(1)
          if (username.length < 5 || username.length > 32) {
            return 'Username должен быть от 5 до 32 символов после @'
          }
          if (!/^[A-Za-z0-9_]+$/.test(username)) {
            return 'Username может содержать только латинские буквы, цифры и _'
          }
          return null
        }
        if (trimmed.startsWith('+')) {
          // Телефон: + и только цифры после
          const phoneDigits = trimmed.slice(1).replace(/\D/g, '')
          if (!phoneDigits) {
            return 'После + должны быть цифры номера'
          }
          if (phoneDigits.length < 10) {
            return 'Номер слишком короткий (минимум 10 цифр после +)'
          }
          return null
        }
        return 'Для Telegram введите номер (начинается с +) или username (начинается с @)'
      }

      // WhatsApp: любой международный формат (E.164), минимум 10 цифр
      const cleaned = trimmed.replace(/\D/g, '')
      if (cleaned.length < 10) {
        return 'Номер слишком короткий. Введите в международном формате (например, 79001234567)'
      }
      return null
    },
    [provider],
  )

  /** Текст подсказки в зависимости от провайдера */
  const placeholderText =
    provider === 'max'
      ? '+7 (XXX) XXX-XX-XX'
      : provider === 'telegram'
        ? '+<код><номер> или @username'
        : '+<код страны><номер>'

  const helperText =
    provider === 'max'
      ? 'Формат: +7XXXXXXXXXX (Россия) или +375XXXXXXXXX (Беларусь)'
      : provider === 'telegram'
        ? 'Телефон: +79001234567 или Username: @username'
        : 'Формат: цифры с кодом страны без + (например, 79001234567 для РФ, 15551234567 для США)'

  const formatHint =
    provider === 'max'
      ? 'Убедитесь, что у получателя установлен MAX и номер зарегистрирован в GREEN-API'
      : `Убедитесь, что у получателя установлен ${provider.toUpperCase()} и номер/username зарегистрирован в GREEN-API`

  /** Обработка изменения ввода */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      let cleaned: string
      if (provider === 'telegram') {
        // Для Telegram разрешаем + в начале и @ в начале, остальные символы - только цифры/буквы/underscore
        cleaned = value.replace(/[^\d+@a-zA-Z_]/g, '')
        // Только один + в начале
        cleaned = cleaned.replace(/\+(?=.*\+)/g, '')
        // Только один @ в начале
        cleaned = cleaned.replace(/@(?=.*@)/g, '')
      } else {
        // Для MAX и WhatsApp: только цифры и + в начале
        cleaned = value.replace(/[^\d+]/g, '').replace(/\+(?=.*\+)/g, '')
      }
      setInputValue(cleaned)
      setError(null)
    },
    [provider],
  )

  /** Обработка отправки формы */
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const validationError = validateInput(inputValue)
      if (validationError) {
        setError(validationError)
        return
      }

      setIsSubmitting(true)
      try {
        // Подготавливаем identifier для передачи провайдеру
        let identifier: string
        if (provider === 'telegram') {
          const trimmed = inputValue.trim()
          if (trimmed.startsWith('@')) {
            // Username передаём как есть (с @)
            identifier = trimmed
          } else if (trimmed.startsWith('+')) {
            // Телефон: передаём только цифры (без +)
            identifier = trimmed.slice(1).replace(/\D/g, '')
          } else {
            // На всякий случай - только цифры
            identifier = trimmed.replace(/\D/g, '')
          }
        } else {
          // MAX, WhatsApp: только цифры
          identifier = inputValue.replace(/\D/g, '')
        }
        await onCreateChat(identifier)
      } finally {
        setIsSubmitting(false)
      }
    },
    [inputValue, validateInput, onCreateChat, provider],
  )

  return (
    <div
      className={styles.container}
      role="region"
      aria-label="Создание нового чата"
    >
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>

      <h2 className={styles.title}>Новый чат</h2>
      <p className={styles.description}>
        Введите номер телефона или username получателя, чтобы начать переписку в{' '}
        {provider.toUpperCase()}
      </p>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.inputWrapper}>
          <label htmlFor="phoneNumber" className={styles.label}>
            {provider === 'telegram'
              ? 'Телефон или Username'
              : 'Номер телефона'}
          </label>
          <input
            id="phoneNumber"
            type="tel"
            className={`${styles.input} ${error ? styles.inputError : ''}`}
            value={inputValue}
            onChange={handleChange}
            placeholder={placeholderText}
            disabled={isSubmitting}
            aria-describedby={error ? 'phone-error' : 'phone-hint'}
            aria-invalid={!!error}
            autoComplete="tel"
            inputMode={provider === 'telegram' ? 'text' : 'tel'}
          />
          {error ? (
            <p id="phone-error" className={styles.errorText} role="alert">
              {error}
            </p>
          ) : (
            <p id="phone-hint" className={styles.helperText}>
              {helperText}
            </p>
          )}
        </div>

        <button
          type="submit"
          className={styles.btn}
          disabled={isSubmitting}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Создание чата...' : 'Создать чат'}
        </button>
      </form>

      <p className={styles.formatHint}>{formatHint}</p>
    </div>
  )
}
