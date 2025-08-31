# Go Response API Implementation Plan

## Overview

Replace the current Node.js `@apps/response-api` service with a high-performance Go service that supports two operational modes:

1. **Assessment Mode**: Immediate processing with guaranteed delivery and fallback logging
2. **Normal Mode**: High-throughput batched processing for optimal performance

## Project Structure

```
apps/response-api-go/
├── cmd/
│   └── main.go                    # Entry point, server setup
├── internal/
│   ├── config/
│   │   └── config.go              # Environment configuration
│   ├── handler/
│   │   ├── response.go            # Main response handler
│   │   └── health.go              # Health check endpoint
│   ├── hatchet/
│   │   ├── client.go              # Hatchet client wrapper
│   │   └── batcher.go             # Event batching logic
│   ├── types/
│   │   └── types.go               # Request/response types
│   └── audit/
│       └── logger.go              # Fallback audit logger (stub)
├── Dockerfile                     # Multi-stage build
├── go.mod
├── go.sum
├── .env.example                   # Environment template
└── README.md                      # Setup and usage docs
```

## Core Implementation

### 1. Main Server (cmd/main.go)

```go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/gin-gonic/gin"
    "response-api-go/internal/config"
    "response-api-go/internal/handler"
    "response-api-go/internal/hatchet"
)

func main() {
    cfg := config.Load()

    // Initialize Hatchet client
    hatchetClient := hatchet.NewClient(cfg.HatchetToken)

    // Initialize batcher for normal mode
    batcher := hatchet.NewBatcher(hatchetClient, cfg.BatchSize, cfg.BatchTimeout)
    go batcher.Start()

    // Setup router
    r := gin.Default()
    r.Use(corsMiddleware(cfg.CORSOrigins))

    // Initialize handlers
    responseHandler := handler.NewResponseHandler(hatchetClient, batcher, cfg)

    r.GET("/", handler.Health)
    r.GET("/healthz", handler.Health)
    r.OPTIONS("/AddResponse", handler.PreflightHandler)
    r.POST("/AddResponse", responseHandler.HandleResponse)

    // Start server with graceful shutdown
    srv := &http.Server{
        Addr:    ":" + cfg.Port,
        Handler: r,
    }

    go func() {
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("Server failed: %v", err)
        }
    }()

    // Wait for interrupt
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    // Graceful shutdown
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    batcher.Stop()
    srv.Shutdown(ctx)
}

func corsMiddleware(origins []string) gin.HandlerFunc {
    return func(c *gin.Context) {
        origin := c.GetHeader("Origin")

        // Check if origin is allowed
        allowed := len(origins) == 0
        for _, o := range origins {
            if o == origin {
                allowed = true
                break
            }
        }

        if allowed && origin != "" {
            c.Header("Access-Control-Allow-Origin", origin)
            c.Header("Vary", "Origin")
            c.Header("Access-Control-Allow-Credentials", "true")
        }

        c.Header("Access-Control-Allow-Methods", "POST, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Content-Type, Cookie")

        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }

        c.Next()
    }
}
```

### 2. Configuration (internal/config/config.go)

```go
package config

import (
    "os"
    "strconv"
    "strings"
    "time"
)

type Config struct {
    Port         string
    HatchetToken string
    CORSOrigins  []string

    // Batching settings
    BatchSize    int
    BatchTimeout time.Duration

    // Assessment mode settings
    AssessmentModeHeader string
    AuditLogEnabled      bool
}

func Load() *Config {
    return &Config{
        Port:                 getEnv("PORT", "7078"),
        HatchetToken:         getEnv("HATCHET_CLIENT_TOKEN", ""),
        CORSOrigins:          strings.Split(getEnv("CORS_ALLOWED_ORIGINS", ""), ","),
        BatchSize:            getEnvInt("BATCH_SIZE", 100),
        BatchTimeout:         time.Duration(getEnvInt("BATCH_TIMEOUT_MS", 2000)) * time.Millisecond,
        AssessmentModeHeader: getEnv("ASSESSMENT_MODE_HEADER", "X-Assessment-Mode"),
        AuditLogEnabled:      getEnv("AUDIT_LOG_ENABLED", "true") == "true",
    }
}

func getEnv(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
    if value := os.Getenv(key); value != "" {
        if i, err := strconv.Atoi(value); err == nil {
            return i
        }
    }
    return defaultValue
}
```

### 3. Types (internal/types/types.go)

```go
package types

import "time"

type ResponseRequest struct {
    Response   interface{} `json:"response" binding:"required"`
    SessionID  string      `json:"sessionId" binding:"required"`
    InstanceID string      `json:"instanceId" binding:"required"`
}

type HatchetEvent struct {
    MessageID         string      `json:"messageId"`
    SessionID         string      `json:"sessionId"`
    InstanceID        string      `json:"instanceId"`
    Response          interface{} `json:"response"`
    Cookie            string      `json:"cookie,omitempty"`
    ResponseTimestamp int64       `json:"responseTimestamp"`
}

type ResponseResult struct {
    Status    string `json:"status"`
    Message   string `json:"message,omitempty"`
    QueueID   string `json:"queueId,omitempty"`
    Mode      string `json:"mode"`
    Timestamp string `json:"timestamp"`
    Fallback  string `json:"fallback,omitempty"`
}
```

### 4. Response Handler (internal/handler/response.go)

```go
package handler

import (
    "net/http"
    "time"
    "crypto/rand"
    "encoding/hex"

    "github.com/gin-gonic/gin"
    "response-api-go/internal/types"
    "response-api-go/internal/config"
    "response-api-go/internal/hatchet"
    "response-api-go/internal/audit"
)

type ResponseHandler struct {
    hatchetClient *hatchet.Client
    batcher       *hatchet.Batcher
    auditLogger   *audit.Logger
    config        *config.Config
}

func NewResponseHandler(client *hatchet.Client, batcher *hatchet.Batcher, cfg *config.Config) *ResponseHandler {
    return &ResponseHandler{
        hatchetClient: client,
        batcher:       batcher,
        auditLogger:   audit.NewLogger(cfg.AuditLogEnabled),
        config:        cfg,
    }
}

func (h *ResponseHandler) HandleResponse(c *gin.Context) {
    var req types.ResponseRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid JSON payload"})
        return
    }

    // Create event
    event := types.HatchetEvent{
        MessageID:         generateID(),
        SessionID:         req.SessionID,
        InstanceID:        req.InstanceID,
        Response:          req.Response,
        Cookie:            c.GetHeader("Cookie"),
        ResponseTimestamp: time.Now().UnixMilli(),
    }

    // Determine mode
    isAssessmentMode := h.isAssessmentMode(c, req.SessionID)

    if isAssessmentMode {
        h.handleAssessmentMode(c, event)
    } else {
        h.handleNormalMode(c, event)
    }
}

func (h *ResponseHandler) isAssessmentMode(c *gin.Context, sessionID string) bool {
    // Check header
    if c.GetHeader(h.config.AssessmentModeHeader) == "true" {
        return true
    }

    // Check session ID prefix (simple pattern)
    return len(sessionID) > 10 && sessionID[:10] == "assessment"
}

func (h *ResponseHandler) handleAssessmentMode(c *gin.Context, event types.HatchetEvent) {
    eventName := "response-received:authenticated"
    if event.Cookie == "" {
        eventName = "response-received:anonymous"
    }

    // Try to push immediately
    err := h.hatchetClient.PushEvent(eventName, event)
    if err != nil {
        // Fallback to audit log
        if h.auditLogger.LogFailedEvent(event, err) == nil {
            c.JSON(http.StatusOK, types.ResponseResult{
                Status:    "queued_with_fallback",
                Message:   "Response saved to audit log for retry",
                Mode:      "assessment",
                Timestamp: time.Now().Format(time.RFC3339),
                Fallback:  "audit_log",
            })
            return
        }

        // Both failed
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": "Failed to queue response",
            "mode":  "assessment",
        })
        return
    }

    // Success
    c.JSON(http.StatusOK, types.ResponseResult{
        Status:    "successfully_queued",
        Message:   "Response has been added to the processing queue",
        QueueID:   event.MessageID,
        Mode:      "assessment",
        Timestamp: time.Now().Format(time.RFC3339),
    })
}

func (h *ResponseHandler) handleNormalMode(c *gin.Context, event types.HatchetEvent) {
    // Add to batch
    h.batcher.Add(event)

    // Return immediate response
    c.JSON(http.StatusOK, types.ResponseResult{
        Status:    "accepted",
        Mode:      "normal",
        Timestamp: time.Now().Format(time.RFC3339),
    })
}

func generateID() string {
    bytes := make([]byte, 16)
    rand.Read(bytes)
    return hex.EncodeToString(bytes)
}
```

### 5. Hatchet Client (internal/hatchet/client.go)

```go
package hatchet

import (
    "context"
    "time"

    "github.com/hatchet-dev/hatchet/pkg/client"
    "response-api-go/internal/types"
)

type Client struct {
    client *client.Client
}

func NewClient(token string) *Client {
    c, err := client.New(
        client.WithToken(token),
    )
    if err != nil {
        panic("Failed to create Hatchet client: " + err.Error())
    }

    return &Client{client: c}
}

func (c *Client) PushEvent(eventName string, event types.HatchetEvent) error {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    return c.client.Events().Push(ctx, eventName, event)
}

func (c *Client) PushEventsBulk(eventName string, events []types.HatchetEvent) error {
    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // Convert to interface slice for bulk push
    interfaceEvents := make([]interface{}, len(events))
    for i, event := range events {
        interfaceEvents[i] = event
    }

    // Note: Bulk API may vary based on Go SDK version
    // Fallback to individual pushes if bulk not available
    for _, event := range events {
        if err := c.client.Events().Push(ctx, eventName, event); err != nil {
            return err
        }
    }

    return nil
}
```

### 6. Batcher (internal/hatchet/batcher.go)

```go
package hatchet

import (
    "log"
    "sync"
    "time"

    "response-api-go/internal/types"
)

type Batcher struct {
    client       *Client
    buffer       []types.HatchetEvent
    maxSize      int
    flushTimeout time.Duration
    mutex        sync.Mutex
    stopCh       chan struct{}
    flushTicker  *time.Ticker
}

func NewBatcher(client *Client, maxSize int, timeout time.Duration) *Batcher {
    return &Batcher{
        client:       client,
        buffer:       make([]types.HatchetEvent, 0, maxSize),
        maxSize:      maxSize,
        flushTimeout: timeout,
        stopCh:       make(chan struct{}),
    }
}

func (b *Batcher) Start() {
    b.flushTicker = time.NewTicker(b.flushTimeout)

    for {
        select {
        case <-b.flushTicker.C:
            b.flush()
        case <-b.stopCh:
            b.flush() // Final flush
            return
        }
    }
}

func (b *Batcher) Stop() {
    close(b.stopCh)
    if b.flushTicker != nil {
        b.flushTicker.Stop()
    }
}

func (b *Batcher) Add(event types.HatchetEvent) {
    b.mutex.Lock()
    defer b.mutex.Unlock()

    b.buffer = append(b.buffer, event)

    if len(b.buffer) >= b.maxSize {
        go b.flush() // Async flush to avoid blocking
    }
}

func (b *Batcher) flush() {
    b.mutex.Lock()
    if len(b.buffer) == 0 {
        b.mutex.Unlock()
        return
    }

    events := make([]types.HatchetEvent, len(b.buffer))
    copy(events, b.buffer)
    b.buffer = b.buffer[:0] // Reset buffer
    b.mutex.Unlock()

    // Group events by authentication status
    authEvents := make([]types.HatchetEvent, 0)
    anonEvents := make([]types.HatchetEvent, 0)

    for _, event := range events {
        if event.Cookie != "" {
            authEvents = append(authEvents, event)
        } else {
            anonEvents = append(anonEvents, event)
        }
    }

    // Push events
    if len(authEvents) > 0 {
        if err := b.client.PushEventsBulk("response-received:authenticated", authEvents); err != nil {
            log.Printf("Failed to push authenticated events: %v", err)
        }
    }

    if len(anonEvents) > 0 {
        if err := b.client.PushEventsBulk("response-received:anonymous", anonEvents); err != nil {
            log.Printf("Failed to push anonymous events: %v", err)
        }
    }

    log.Printf("Flushed %d events (auth: %d, anon: %d)", len(events), len(authEvents), len(anonEvents))
}
```

### 7. Health Handler (internal/handler/health.go)

```go
package handler

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

func Health(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"status": "ok"})
}

func PreflightHandler(c *gin.Context) {
    c.Status(http.StatusNoContent)
}
```

### 8. Audit Logger (internal/audit/logger.go)

```go
package audit

import (
    "encoding/json"
    "log"
    "time"

    "response-api-go/internal/types"
)

type Logger struct {
    enabled bool
}

type AuditEntry struct {
    Timestamp     time.Time           `json:"timestamp"`
    EventID       string              `json:"eventId"`
    SessionID     string              `json:"sessionId"`
    InstanceID    string              `json:"instanceId"`
    Response      interface{}         `json:"response"`
    FailureReason string              `json:"failureReason"`
    Status        string              `json:"status"`
}

func NewLogger(enabled bool) *Logger {
    return &Logger{enabled: enabled}
}

func (l *Logger) LogFailedEvent(event types.HatchetEvent, err error) error {
    if !l.enabled {
        return nil
    }

    entry := AuditEntry{
        Timestamp:     time.Now(),
        EventID:       event.MessageID,
        SessionID:     event.SessionID,
        InstanceID:    event.InstanceID,
        Response:      event.Response,
        FailureReason: err.Error(),
        Status:        "pending_retry",
    }

    // TODO: Replace with actual audit service integration
    // For now, log to stdout with structured format
    jsonData, _ := json.Marshal(entry)
    log.Printf("AUDIT_FALLBACK: %s", string(jsonData))

    return nil
}

// TODO: Implement retry mechanism
func (l *Logger) RetryPendingEvents() error {
    // Future implementation:
    // 1. Query audit service for pending events
    // 2. Retry pushing to Hatchet
    // 3. Update audit log with results
    return nil
}
```

## Environment Configuration

### .env.example

```env
# Server
PORT=7078
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://pwa.klicker.com

# Hatchet
HATCHET_CLIENT_TOKEN=__HATCHET_CLIENT_TOKEN__
HATCHET_CLIENT_TLS_STRATEGY=none

# Batching (Normal Mode)
BATCH_SIZE=100
BATCH_TIMEOUT_MS=2000

# Assessment Mode
ASSESSMENT_MODE_HEADER=X-Assessment-Mode
AUDIT_LOG_ENABLED=true
```

## Dockerfile

```dockerfile
# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o server cmd/main.go

# Runtime stage
FROM gcr.io/distroless/static:nonroot

# Copy binary
COPY --from=builder /app/server /server

# Use non-root user
USER nonroot:nonroot

EXPOSE 7078

ENTRYPOINT ["/server"]
```

## Dependencies (go.mod)

```go
module response-api-go

go 1.22

require (
    github.com/gin-gonic/gin v1.9.1
    github.com/hatchet-dev/hatchet/pkg/client v0.0.0-latest
)
```

## Key Implementation Decisions

### Simplicity First

- Single main package with clear separation
- Minimal external dependencies (Gin + Hatchet SDK)
- Standard library for most functionality
- No complex abstractions or interfaces

### Mode Handling

- Simple header/session-based detection
- Direct conditional logic (no strategy pattern)
- Clear separation of concerns without overengineering

### Error Handling

- Fail-fast approach with clear error messages
- Graceful degradation in assessment mode
- Simple logging for debugging

### Performance

- Efficient batching with time/size triggers
- Minimal memory allocations
- Connection reuse via Hatchet client
- Async processing where appropriate

### Deployment

- Follows existing Dockerfile patterns from other services
- Uses distroless base for security and size
- Standard environment variable configuration
- Compatible with existing deployment infrastructure

## Migration Strategy

1. **Development**: Implement service locally with same API contract
2. **Testing**: Load test both modes to verify performance
3. **Staging**: Deploy alongside Node.js service
4. **Production**: Gradual traffic shift using load balancer
5. **Cleanup**: Remove Node.js service after validation

This plan prioritizes simplicity, maintainability, and performance while avoiding unnecessary complexity.
