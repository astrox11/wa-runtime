FROM oven/bun:latest

RUN apt-get update && apt-get install -y \
    git \
    curl \
    ffmpeg \
    libwebp-dev \
    ca-certificates \
    golang \
    redis-server \
    && rm -rf /var/lib/apt/lists/*

RUN bun -v && go version

RUN git clone https://github.com/astrox11/Whatsaly /root/Whatsaly

WORKDIR /root/Whatsaly

RUN cd core && bun install && cd ..

RUN cd api && go mod download

EXPOSE 8000 6379

WORKDIR /root/Whatsaly/api

CMD redis-server --port 6379 --daemonize yes && go run main.go