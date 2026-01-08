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

## Setup Instructions

#### Prerequisites

Ensure these are installed on your system.

- [Go](https://golang.org)
- [Bun.js](https://bun.sh)
- [FFmpeg](https://ffmpeg.org)
- [libwebp](https://developers.google.com/speed/webp)

#### Installation

```bash
git clone https://github.com/astrox11/Whatsaly
cd Whatsaly
cd core bun i
cd ..
cd api
go run .
```

## Contributing

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

## Acknowledgements

This project uses the Baileys library:

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API

Special thanks to all contributors and the open-source community.
