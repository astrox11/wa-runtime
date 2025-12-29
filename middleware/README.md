# Middleware Layer

The middleware layer provides an abstraction between WhatsApp (Baileys) and the application, offering normalized event handling with session-aware data isolation.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 WhatsApp Integration (Baileys)               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE LAYER                          │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────┐   │
│  │ Message Handler │→ │  Dispatcher  │→ │ EventEmitter  │   │
│  │  (Normalize)    │  │   (Route)    │  │   (Emit)      │   │
│  └─────────────────┘  └──────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Services                       │
│            (Commands, Persistence, Business Logic)           │
└─────────────────────────────────────────────────────────────┘
```

## Files

| File | Description |
|------|-------------|
| `index.ts` | Main entry point with `MiddlewareService` class (EventEmitter-based) |
| `types.ts` | TypeScript interfaces and type definitions |
| `messageHandler.ts` | Message normalization and classification |
| `commandDispatcher.ts` | Command routing and permission checking |

## Quick Start

### Basic Usage

```typescript
import { createMiddleware } from "./middleware";

// Create a middleware instance for a session
const middleware = createMiddleware({
  sessionId: "main",
  debug: true,
  ignoreSelf: false,
});

// Listen for events
middleware.on("message", (message, client) => {
  console.log(`Received message: ${message.text}`);
});

middleware.on("command", (message, client) => {
  console.log(`Command detected: ${message.command?.name}`);
});

middleware.on("connection", (event) => {
  console.log(`Connection state: ${event.payload.state}`);
});

// Process incoming messages
const result = await middleware.processMessage(client, rawMessage, "public");
```

### With Command Registry

```typescript
import { createMiddleware, createRegistry } from "./middleware";

const commands = [
  {
    pattern: "ping",
    category: "util",
    async exec(msg) {
      await msg.reply("Pong!");
    },
  },
  {
    pattern: "help",
    alias: ["h"],
    category: "util",
    async exec(msg, sock, args) {
      await msg.reply("Available commands: ping, help");
    },
  },
];

const middleware = createMiddleware({ sessionId: "main" });
middleware.setRegistry(createRegistry(commands));

// Now commands will be automatically dispatched
await middleware.processMessage(client, rawMessage, "public");
```

## API Reference

### MiddlewareService

The main class extending `EventEmitter` for processing WhatsApp events.

#### Constructor Options

```typescript
interface MiddlewareOptions {
  sessionId?: string;    // Session identifier (default: "main")
  ignoreSelf?: boolean;  // Skip self-sent messages (default: false)
  debug?: boolean;       // Enable debug logging (default: false)
}
```

#### Methods

| Method | Description |
|--------|-------------|
| `setRegistry(registry)` | Set the command registry for routing |
| `setEventHandlers(handlers)` | Set event-based command handlers |
| `processMessage(client, message, mode)` | Process a raw WhatsApp message |
| `processConnectionUpdate(update)` | Process connection state changes |
| `processGroupParticipantsUpdate(update)` | Process group participant changes |
| `processGroupUpdate(update)` | Process group metadata updates |
| `processLidMappingUpdate(update)` | Process LID mapping updates |
| `processMessageDelete(deleteInfo)` | Process message deletions |
| `emitError(error, context)` | Emit an error event |

#### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `message` | `(NormalizedMessage, WASocket)` | Any valid message received |
| `command` | `(NormalizedMessage, WASocket)` | Command detected in message |
| `connection` | `NormalizedEvent<ConnectionPayload>` | Connection state change |
| `group_participants` | `NormalizedEvent<GroupParticipantsPayload>` | Group member changes |
| `group_update` | `NormalizedEvent<GroupUpdatePayload>` | Group metadata changes |
| `lid_mapping` | `NormalizedEvent<LidMappingPayload>` | LID mapping updates |
| `message_delete` | `NormalizedEvent<MessageDeletePayload>` | Message deletions |
| `credentials` | `NormalizedEvent<void>` | Credentials updated |
| `error` | `(Error, string)` | Error occurred |

### NormalizedMessage

Standardized message structure with session context.

```typescript
interface NormalizedMessage {
  id: string;
  sessionId: string;
  chatId: string;
  senderId: string;
  senderAltId?: string;
  senderName: string;
  isGroup: boolean;
  isFromSelf: boolean;
  isSudo: boolean;
  classification: MessageClassification;
  text?: string;
  command?: CommandInfo;
  mediaType?: MediaType;
  hasQuoted: boolean;
  timestamp: number;
  device: "web" | "unknown" | "android" | "ios" | "desktop";
  raw: WAMessage;
}
```

### CommandDefinition

Interface for defining commands.

```typescript
interface CommandDefinition {
  pattern?: string;           // Command name
  alias?: string[];           // Alternative names
  category?: string;          // Category for organization
  event?: boolean;            // Event-based handler
  dontAddToCommandList?: boolean;
  isGroup?: boolean;          // Group-only command
  isAdmin?: boolean;          // Requires group admin
  isSudo?: boolean;           // Requires sudo privileges
  exec: (msg, sock?, args?) => Promise<any>;
}
```

## Multi-Session Support

The middleware supports per-session data isolation. Each session has:

- Unique session ID
- Isolated sudo users
- Separate contacts and messages
- Independent bot mode settings

```typescript
// Create middleware for different sessions
const mainMiddleware = createMiddleware({ sessionId: "main" });
const sessionMiddleware = createMiddleware({ sessionId: "session_12345" });

// Each middleware instance operates independently
mainMiddleware.on("message", handleMainMessage);
sessionMiddleware.on("message", handleSessionMessage);
```

## Message Classification

Messages are automatically classified into types:

| Classification | Description |
|----------------|-------------|
| `text` | Plain text message |
| `command` | Text that matches a command pattern |
| `media` | Image, video, audio, or document |
| `sticker` | Sticker message |
| `button_response` | Button interaction response |
| `protocol` | System/protocol message |
| `unknown` | Unclassified message |

## Permission System

Commands can require specific permissions:

```typescript
{
  pattern: "admin-cmd",
  isGroup: true,    // Only works in groups
  isAdmin: true,    // Requires group admin
  async exec(msg) { /* ... */ }
}

{
  pattern: "sudo-cmd",
  isSudo: true,     // Requires sudo privileges
  async exec(msg) { /* ... */ }
}
```

## Best Practices

1. **Always specify sessionId** for multi-session deployments
2. **Use event listeners** for decoupled handling
3. **Handle errors** via the `error` event
4. **Enable debug mode** during development
5. **Register commands** before processing messages

## Example: Full Integration

```typescript
import { createMiddleware, createRegistry } from "./middleware";

// Initialize middleware
const middleware = createMiddleware({
  sessionId: "main",
  debug: process.env.NODE_ENV === "development",
});

// Load and register commands
const commands = await loadCommandsFromModules("./lib/modules");
middleware.setRegistry(createRegistry(commands));

// Set up event listeners
middleware.on("connection", (event) => {
  if (event.payload.state === "open") {
    console.log("Connected to WhatsApp");
  } else if (event.payload.isLoggedOut) {
    console.log("Logged out");
  }
});

middleware.on("error", (error, context) => {
  console.error(`Error in ${context}:`, error);
});

// In your socket event handler
sock.ev.on("messages.upsert", async ({ messages }) => {
  for (const msg of messages) {
    await middleware.processMessage(sock, msg, getMode(sessionId));
  }
});
```
