FROM oven/bun:latest

RUN apt-get update && apt-get install -y \
    git \
    curl \
    ffmpeg \
    libwebp-dev \
    ca-certificates \
    golang \
    && rm -rf /var/lib/apt/lists/*

RUN bun -v && go version

RUN git clone https://github.com/astrox11/Whatsaly /root/Whatsaly

WORKDIR /root/Whatsaly

RUN bun install
RUN go mod download
RUN chmod +x ./start.sh

EXPOSE 8000

WORKDIR /root/Whatsaly/api

CMD ["go", "run", "main.go"]
