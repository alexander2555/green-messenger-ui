# Green Messenger UI

React + TypeScript + Vite frontend for multi-provider messenger integration (WhatsApp via Green API, Telegram, MAX).

## Stack

- React 19
- TypeScript (strict)
- Vite 8
- Custom CSS with design tokens (CSS custom properties)
- ESLint + Prettier

## Commands

```bash
npm i --legacy-peer-deps     # install dependencies
npm run dev      # start dev server
npm run build    # typecheck + production build
npm run preview  # preview production build
npm run lint     # lint source files
npm run typecheck # TypeScript type checking
```

## Project Structure

```
src/
├── components/     # UI components (App, ChatScreen, MessageInput, etc.)
├── context/        # React Context providers (ConnectionsContext)
├── hooks/          # Custom React hooks (useNotificationsPolling)
├── providers/      # Provider implementations (WhatsApp, Telegram, MAX)
├── styles/         # Global styles with CSS custom properties
├── types/          # TypeScript types
└── main.tsx        # App entry point
```

## Architecture

See [docs/spec.md](docs/spec.md) for specification and [docs/architecture.md](docs/architecture.md) for architecture decisions.

## License

ISC