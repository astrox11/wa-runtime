# wa-runtime

wa-runtime is a full WhatsApp runtime that provides a backend service for session management, authentication, messaging, and statistics. It includes a web dashboard built with Astro.js for managing WhatsApp sessions.

## Features

- **Multi-session support**: Manage multiple isolated WhatsApp sessions
- **WebSocket API**: Real-time bidirectional communication
- **REST API**: Backend service exposing APIs for external clients
- **Web Dashboard**: Built with Astro.js for session management and monitoring
- **WhatsApp Pairing**: Uses pairing code authentication (no QR code scanning)
- **Real-time Statistics**: Track messages, uptime, and session health
- **Network Monitoring**: Automatic pause/resume on network issues
- **Extensible Middleware**: Add custom behavior and business logic

## Architecture

```
wa-runtime/
├── Backend Server (Bun.js) - Port 3000
│   ├── HTTP API
│   ├── WebSocket API (/ws/stats)
│   ├── Proxy to Astro SSR
│   ├── Session Management
│   ├── Authentication
│   └── WhatsApp Core (Baileys)
│
└── Frontend (Astro.js SSR) - Port 4321
    ├── Session Creation
    ├── Pairing Flow
    └── Dashboard
```

**Unified Access**: Users access port 3000 which handles API requests directly and proxies page requests to the Astro SSR server.

## Requirements

- [Node.js](https://nodejs.org/) (v20+)
- [Bun.js](https://bun.sh/)
- [ffmpeg](https://www.ffmpeg.org/)
- [libwebp](https://developers.google.com/speed/webp/download)

## Installation

```bash
# Clone the repository
git clone https://github.com/astrox11/wa-runtime
cd wa-runtime

# Install all dependencies (backend + frontend)
bun install
```

## Running the Application

### Production Mode

For production, start both the backend and Astro SSR server:

```bash
bun run start
```

Access the dashboard at `http://localhost:3000`

### Development Mode

For development with hot-reload on frontend changes:

```bash
bun run dev
```

Access the dashboard at `http://localhost:4321` during development (with Vite proxy).

### Building the Frontend

If you need to rebuild the frontend after changes:

```bash
bun run web:build
```

## Configuration

Configuration can be set via environment variables or the `config.ts` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `PHONE_NUMBER` | Phone number for auto-session creation | - |
| `BOT_NAME` | Display name for the bot | `wa-runtime` |
| `API_PORT` | Backend API port | `3000` |
| `API_HOST` | Backend API host | `0.0.0.0` |

### Using .env file

```bash
PHONE_NUMBER=14155551234
BOT_NAME=MyBot
API_PORT=3000
```

## API Reference

### WebSocket API

Connect to `/ws/stats` for real-time bidirectional communication:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws/stats');

// Receive stats broadcasts
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'stats') {
    console.log('Sessions:', data.data.sessions);
    console.log('Network:', data.data.network);
  }
};

// Send requests
ws.send(JSON.stringify({
  action: 'createSession',
  requestId: 'req_1',
  params: { phoneNumber: '14155551234' }
}));
```

**WebSocket Actions:**
- `getSessions` - List all sessions
- `createSession` - Create a new session
- `deleteSession` - Delete a session
- `getAuthStatus` - Get authentication status
- `getStats` - Get overall statistics
- `getSessionStats` - Get session statistics
- `getMessages` - Get session messages
- `getConfig` - Get runtime configuration
- `getNetworkState` - Get network health state

### REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions` | Create a new session |
| GET | `/api/sessions/:id` | Get session details |
| DELETE | `/api/sessions/:id` | Delete a session |
| GET | `/api/auth/status/:sessionId` | Get authentication status |
| GET | `/api/stats` | Get overall runtime statistics |
| GET | `/api/stats/:sessionId` | Get session-specific statistics |
| GET | `/api/config` | Get runtime configuration |
| GET | `/api/network` | Get network state |
| GET | `/api/messages/:sessionId` | Get session messages |

### Example: Create a Session

```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "14155551234"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "session_14155551234",
    "pairingCode": "12345678",
    "pairingCodeFormatted": "1234-5678"
  }
}
```

## Web Dashboard

The web dashboard provides a visual interface for managing sessions:

### Home Page
- Create new sessions by entering phone number and bot name
- View existing sessions with real-time status
- Quick stats: total sessions, active sessions, messages
- Network health indicator

### Pairing Page
- Displays the 8-digit pairing code
- Instructions for linking via WhatsApp
- Automatic redirect to dashboard on success

### Dashboard
- Session statistics (messages, uptime, health)
- Activity graphs showing messages per hour
- Runtime statistics (total sessions, server uptime)
- Session management actions

## CLI Usage

```bash
# Create a session
bun start session create 14155551234

# List all sessions
bun start session list

# Delete a session
bun start session delete <session_id>
```

## Docker

```bash
docker build -t wa-runtime .
docker run -p 3000:3000 wa-runtime
```

## Supported Platforms

- Windows
- Linux
- macOS
- Docker

**Not supported:**
- Android (Bun.js limitation)

## Contributing

Contributions are welcome! wa-runtime is evolving and community input directly influences its direction.

## License

This project is licensed under the terms specified in the LICENSE file.
