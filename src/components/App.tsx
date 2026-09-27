import {
  ConnectionsProvider,
  useConnections,
} from '../context/ConnectionsContext'
import { ProviderSettingsScreen } from './ProviderSettingsScreen'
import ChatScreen from './ChatScreen'
import '../styles/index.css'

/** Внутренний компонент, который рендерит экран настроек или чат */
function AppContent() {
  const { activeConnection } = useConnections()

  // Если нет активного подключения — показываем настройки
  if (!activeConnection) {
    return <ProviderSettingsScreen />
  }

  // Иначе — экран чата
  return <ChatScreen />
}

/** Главный компонент приложения.
 * Оборачивает всё в ConnectionsProvider для доступа к подключениям.
 */
export function App() {
  return (
    <ConnectionsProvider>
      <AppContent />
    </ConnectionsProvider>
  )
}
