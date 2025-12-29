# AstroBridge

AstroBridge provides an abstraction layer for programmatic control of WhatsApp interactions via text commands. It manages messages, groups, communities, channels, and events while exposing extension points for middleware-driven logic.

It is designed to be simple to start, but flexible enough to grow into a backend service or a bridge for frontend applications.

## Installation

Before running AstroBridge, make sure the following tools are installed on your system.

Required dependencies:

- [**Node.js**](https://nodejs.org/)
- [**Bun.js**](https://bun.com/)
- [**ffmpeg**](https://www.ffmpeg.org/)
- [**libwebp**](https://developers.google.com/speed/webp/download)

These are required for media handling and WhatsApp message processing. If any of these are missing, things will break quietly and then loudly.

## Supported Platforms

AstroBridge currently supports:

- [Windows](https://www.microsoft.com/en-us/windows?r=1)
- [Linux](https://www.fedoraproject.org/)
- [macOS](https://www.apple.com/os/macos/)
- [Docker](https://www.docker.com/)

Not supported:

- [Android](https://www.android.com/)
  Bun does not support Android for now.

## How to Use

### Using AstroBridge as a CLI Tool

1. Clone the repository.

```
git clone https://github.com/astrox11/wa-bridge
```

2. From the root of the project, install dependencies:

```
bun install
```

3. Start the application:

```
bun start
```

This will kick-start the WhatsApp session setup and begin the interaction flow.

#### Configuration

You **must** provide a phone number before starting.

You have two options:

**Option 1: config.ts**

Set the `PHONE_NUMBER` constant in `config.ts`.

**Option 2: .env file**

Create a `.env` file in the project root and add:

```
PHONE_NUMBER=2348012345678
```

Important rules for the phone number:

- Do **not** include the `+` symbol
- Include your country code
- No spaces or separators

Correct example:

```
PHONE_NUMBER=2348012345678
```

Incorrect examples:

```
+2348012345678
234 801 234 5678
```

If the number is invalid, the startup process will stop early. This is intentional.

### Using AstroBridge as Middleware

AstroBridge can be extended using middleware to add custom behavior, business logic, or frontend integrations.

To see a real-world example of this, check out the merged middleware pull request:

[https://github.com/astrox11/wa-bridge/pull/4](https://github.com/astrox11/wa-bridge/pull/4)

That PR includes inline comments demonstrating:

- How to register middleware
- How to intercept and extend message handling
- How to expose AstroBridge logic to frontend services

This approach allows AstroBridge to act as a backend bridge rather than just a CLI-driven bot.

If you are building dashboards, admin panels, or automation services, this is the intended path.

## Contributing

Contributions are welcome.

AstroBridge is evolving fast, and community input directly influences its direction. Bug fixes, middleware ideas, documentation improvements, and architectural discussions are all fair game.
