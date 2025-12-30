# Whatsaly

Whatsaly is a full WhatsApp runtime that provides a backend service for session management, authentication, messaging, and statistics. It includes a web dashboard built with Astro.js for managing WhatsApp sessions.

## Features

- **Multi-session support**: Manage multiple isolated WhatsApp sessions
- **WebSocket API**: Real-time bidirectional communication
- **REST API**: Backend service exposing APIs for external clients
- **Web Dashboard**: Built with Astro.js for session management and monitoring
- **WhatsApp Pairing**: Uses pairing code authentication (no QR code scanning)
- **Real-time Statistics**: Track messages, uptime, and session health
- **Network Monitoring**: Automatic pause/resume on network issues
- **Extensible Middleware**: Add custom behavior and business logic
- **Debug Mode**: Configurable logging for development and production

## Setup Instructions

### Requirements

- [Node.js](https://nodejs.org/) (v20+)
- [Bun.js](https://bun.sh/)
- [ffmpeg](https://www.ffmpeg.org/)
- [libwebp](https://developers.google.com/speed/webp/download)

### Installation

```bash
# Clone the repository
git clone https://github.com/astrox11/wa-runtime
cd wa-runtime

# Install all dependencies (backend + frontend)
bun install
```

### Configuration

Create a `.env` file or use environment variables:

| Variable       | Description                            | Default      |
| -------------- | -------------------------------------- | ------------ |
| `PHONE_NUMBER` | Phone number for auto-session creation | -            |
| `BOT_NAME`     | Display name for the bot               | `Whatsaly`   |
| `API_PORT`     | Backend API port                       | `3000`       |
| `API_HOST`     | Backend API host                       | `0.0.0.0`    |
| `DEBUG`        | Enable debug logging                   | `false`      |

Example `.env` file:

```bash
PHONE_NUMBER=14155551234
BOT_NAME=MyBot
API_PORT=3000
DEBUG=true
```

**Debug Mode**: When `DEBUG=true`, all `log.debug`, `log.error`, and `log.trace` messages are visible in the console. When `DEBUG=false`, only `log.info` messages are shown.

### Running the Application

**Production Mode:**

```bash
bun run start
```

Access the dashboard at `http://localhost:3000`

**Development Mode:**

```bash
bun run dev
```

Access the dashboard at `http://localhost:4321` during development.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

All contributions should:
- Be focused on a single change
- Include tests when applicable
- Pass existing tests and checks
- Follow the project's coding style
- Not introduce security risks

## Acknowledgements

This project uses the following open-source libraries:

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API
- [Bun.js](https://bun.sh/) - JavaScript runtime and toolkit
- [Astro.js](https://astro.build/) - Web framework for the dashboard
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework

Special thanks to all contributors and the open-source community.

## License

This project is licensed under the terms specified in the LICENSE file.
