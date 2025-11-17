# AstroBridge

AstroBridge is a high-performance middleware layer for programmatically controlling WhatsApp. It handles message intake, command parsing, outbound actions, and session management—allowing you to interact with WhatsApp seamlessly by sending Messages.

Powered by [Whatsmeow](https://github.com/tulir/whatsmeow), an open-source reverse-engineered WhatsApp client, AstroBridge abstracts away low-level protocol details while giving you full flexibility to send, receive, process, and automate WhatsApp operations with reliability and speed.

# Setup

AstroBridge is currently under active development, expect bugs.
You can get started by cloning the repository:

```
git clone https://github.com/astrox11/AstroBridge
cd AstroBridge
```

Make sure you have the **latest version of Go** installed (Go 1.22+ recommended).


## **Windows**

1. Download and install the latest Go release from the official website:
   [https://go.dev/dl](https://go.dev/dl)
2. Open **PowerShell** and verify installation:

   ```
   go version
   ```
3. Navigate to the cloned project directory:

   ```
   cd AstroBridge
   ```
4. Run the project:

   ```
   go run .
   ```

## **Linux & macOS**

1. Install the latest Go version:

   **Linux (Debian/Ubuntu example)**

   ```
   sudo apt update
   sudo apt install golang
   ```

   *Or manually download Go from [https://go.dev/dl](https://go.dev/dl) for the newest version.*

   **macOS (Homebrew)**

   ```
   brew install go
   ```

2. Verify installation:

   ```
   go version
   ```

3. Move into the project directory:

   ```
   cd AstroBridge
   ```

4. Run the project:

   ```
   go run .
   ```

# Contributing

Contributions are welcome! AstroBridge is evolving, and community input helps shape its direction.

If you’d like to contribute:

1. **Fork** the repository
2. **Create a new branch** for your feature or fix

   ```
   git checkout -b feature-name
   ```
3. **Commit** your changes with clear messages
4. **Push** to your fork
5. Open a **Pull Request** describing what you improved or added

Before submitting, please:

* Ensure code is formatted (`go fmt ./...`)
* Run basic tests or manual checks
* Keep changes focused and well-documented

If you want, I can also add:
✔ issue templates
✔ PR guidelines
✔ coding style rules
✔ architecture overview for contributors
