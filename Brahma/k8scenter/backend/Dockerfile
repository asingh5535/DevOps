FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install git for go modules
RUN apk add --no-cache git ca-certificates

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o kubevision-api \
    ./cmd/server

# ── Runtime image ──────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/kubevision-api .

EXPOSE 8080

ENV GIN_MODE=release
ENV PORT=8080

ENTRYPOINT ["./kubevision-api"]
