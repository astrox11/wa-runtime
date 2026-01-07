# Whatsaly

Whatsaly is an open-source WhatsApp client for automated messaging, event scheduling, group management, and built-in analytics.

## Features

- Multi-session support
- Pairing authentication
- Automated session management
- Live metrics utility
- Debug mode
- Go server orchestration with process management
- SQLite database managed by Go
- Server-Sent Events for real-time updates

## Architecture

Whatsaly uses a two-tier architecture:

1. **Go Server** (port 8000) - Central hub that:
   - Manages the BunJS process lifecycle (start/stop/restart)
   - Handles all SQLite database operations
   - Serves static HTML frontend from `ui/` folder
   - Provides WebSocket and SSE for real-time communication
   - Phone number validation

2. **Bun Service** (port 8001) - WhatsApp runtime that:
   - Handles WhatsApp session management via Baileys
   - Pushes stats to Go server every 2 seconds
   - Fetches database data from Go server

## Project Structure

```
Whatsaly/
├── api/                    # TypeScript API handlers + Go server
│   ├── go/                 # Go server code
│   │   ├── main.go         # Main entry point
│   │   ├── api/            # HTTP handlers
│   │   ├── database/       # SQLite database
│   │   ├── datastore/      # In-memory data store
│   │   ├── phone/          # Phone validation
│   │   ├── processmanager/ # Bun process management
│   │   └── websocket/      # WebSocket hub
│   ├── server.ts           # Bun API server
│   ├── routes.ts           # API routes
│   └── middleware.ts       # API middleware
├── service/                # WhatsApp service (formerly core)
│   ├── auth/               # Authentication
│   ├── class/              # WhatsApp classes (Client, Group, etc.)
│   ├── plugin/             # Plugins
│   └── util/               # Utilities
├── ui/                     # Frontend HTML files
│   ├── index.html          # Main sessions page
│   ├── dashboard.html      # Session dashboard
│   └── pairing.html        # Device pairing
└── start.bat/start.sh      # Start scripts
```

## Setup Instructions

#### Prerequisites

Ensure these are installed on your system.

- [Go](https://golang.org) (1.21+)
- [Bun.js](https://bun.sh)
- [FFmpeg](https://ffmpeg.org)
- [libwebp](https://developers.google.com/speed/webp)

#### Installation

```bash
git clone https://github.com/astrox11/Whatsaly
cd Whatsaly
bun i
```

#### Starting the Server

**Windows:**

```bash
start.bat
```

**Linux/macOS:**

```bash
./start.sh
```

**Or directly:**

```bash
go run api/go/main.go
```

The Go server will automatically start the Bun backend. Access the application at `http://localhost:8000`.

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

## Acknowledgements

This project uses the Baileys library:

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API

Special thanks to all contributors and the open-source community.
