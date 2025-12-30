FROM oven/bun:latest

RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    libwebp-dev \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_25.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN node -v && npm -v && bun -v

# Clone and setup Whatsaly backend
RUN git clone https://github.com/astrox11/wa-runtime /root/Whatsaly

WORKDIR /root/Whatsaly

RUN bun install

# Install and build frontend
WORKDIR /root/Whatsaly/service
RUN npm install
RUN npm run build

WORKDIR /root/Whatsaly

# Expose ports for backend (3000) and frontend (4321)
EXPOSE 3000 4321

# Start both backend and frontend
CMD ["sh", "-c", "bun run server & cd service && npm start"]
