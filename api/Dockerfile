FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application (compile package, not single file)
RUN go build -o main ./cmd/server

# Final stage
FROM alpine:latest

WORKDIR /root/

# Copy the binary from the builder
COPY --from=builder /app/main .
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080

CMD ["./main"]
