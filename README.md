# Whatsaly

Whatsaly is an open source WhatsApp Web runtime built on Baileys and Astro.js. It implements these libraries to create a privacy focused web client with automated session lifecycle management, messaging, authentication, and statistical reporting. A modern web dashboard provides visibility and control over WhatsApp connections, and system state.

## Features

- Multi-session support
- Pairing authentication
- Automated session management
- Live metrics utilty
- Debug mode
- Go server orchestration with process management

## Architecture

Whatsaly uses a two-tier architecture:

1. **Go Proxy Server** (port 8000) - Main entry point that:
   - Manages the BunJS process lifecycle (start/stop/restart)
   - Proxies HTTP and WebSocket requests to the Bun backend
   - Provides process status API endpoints

2. **Bun Backend** (internal port 8001) - Core runtime that:
   - Handles WhatsApp session management via Baileys
   - Serves the Astro.js SSR frontend
   - Provides WebSocket API for real-time communication

## Setup Instructions

#### Prerequisites

Ensure these are installed on your system.

- [Go](https://golang.org) (1.21+)
- [Bun.js](https://bun.sh)
- [Node.js](https://nodejs.org)
- [FFmpeg](https://ffmpeg.org)
- [libwebp](https://developers.google.com/speed/webp)

#### Installation

```bash
git clone https://github.com/astrox11/Whatsaly
cd Whatsaly
bun i
```

#### Build Astro Frontend

```bash
cd service
bun i
bun run build
cd ..
```

#### Starting with Go Server (Recommended)

```bash
go run cmd/server/main.go
```

The Go server will automatically start the Bun backend and proxy requests. Access the application at `http://localhost:8000`.

#### Starting Bun Only (Development)

```bash
bun run start
```

```bash
bun run dev
```

## API Endpoints

### Process Management (Go Server)

- `GET /api/process/status` - Get BunJS process status
- `POST /api/process/restart` - Restart BunJS process
- `GET /api/go/health` - Go server health check

### Core API (Bun Backend)

- `GET /health` - Health check
- `GET /api/stats/full` - Full statistics
- WebSocket `/ws/stats` - Real-time stats and session management

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

## Acknowledgements

This project uses the following open-source libraries:

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Astro.js](https://astro.build/) - Web framework

Special thanks to all contributors and the open-source community.
