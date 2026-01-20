FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application
RUN go build -o main ./cmd/server/main.go

# Final stage
FROM alpine:latest

WORKDIR /root/

# Copy the binary from the builder
COPY --from=builder /app/main .

EXPOSE 8080

CMD ["./main"]
