# Chatbot Enhancements Implementation Plan

## Overview

This document outlines the implementation plan for enhancing the chat application to support:

1. **Multiple MCP servers per chatbot** - Configure different MCP servers (RAG, Python execution, R execution, etc.) per chatbot and chat mode
2. **Per-chatbot Azure OpenAI keys** - Store encrypted Azure OpenAI API keys in the database per chatbot instead of using global environment variables
3. **Tool filtering per mode** - Control which tools from each MCP server are available based on the chat mode (tutor, explainer, etc.)
4. **Priority-based MCP loading** - Define the order in which MCP servers are loaded and how tool conflicts are resolved

## Architecture Goals

- **Relational design** - Use dedicated tables for MCP servers with proper relationships
- **Security** - Encrypt sensitive data using existing `APP_SECRET`
- **Flexibility** - Support dynamic MCP server configurations without code changes
- **Namespace isolation** - Prevent tool naming conflicts between MCP servers
- **Backward compatibility** - Maintain fallback to environment variables during transition

## Database Schema Changes

### 1. New ChatbotMCPServer Table

```prisma
model ChatbotMCPServer {
  id String @id @default(uuid()) @db.Uuid

  name        String @unique  // e.g., "RAG_MCP", "Python_Executor", "R_Executor"
  description String?
  url         String          // MCP server URL
  authType    String          // 'bearer' | 'basic' | 'none'
  authSecret  String?         @db.Text // Encrypted using APP_SECRET

  // Global parameters for this MCP server
  parameters  Json?           // Additional configuration parameters
  isActive    Boolean @default(true)

  // Relations
  configurations ChatbotMCPConfig[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Purpose**: Store reusable MCP server definitions that can be linked to multiple chatbots.

**Key Fields**:
- `name`: Unique identifier for the MCP server (used for tool namespacing)
- `authType`: Determines how authentication headers are built
- `authSecret`: Encrypted secret/token for MCP server authentication
- `parameters`: Additional configuration that might be needed for specific MCP servers

### 2. New ChatbotMCPConfig Junction Table

```prisma
model ChatbotMCPConfig {
  id String @id @default(uuid()) @db.Uuid

  // Relations
  chatbot   Chatbot @relation(fields: [chatbotId], references: [id], onDelete: Cascade)
  chatbotId String  @db.Uuid

  mcpServer   ChatbotMCPServer @relation(fields: [mcpServerId], references: [id], onDelete: Cascade)
  mcpServerId String    @db.Uuid

  // Configuration per chatbot-mode-mcp combination
  chatMode     String          // 'tutor' | 'explainer' | 'default'
  allowedTools Json?           // Array of allowed tool names/patterns (supports wildcards)
  priority     Int @default(0) // Order of MCP servers (lower = higher priority)
  isEnabled    Boolean @default(true)

  // Chatbot-specific parameters that override server defaults
  parameters   Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([chatbotId, mcpServerId, chatMode])
  @@index([chatbotId, chatMode])
}
```

**Purpose**: Define which MCP servers are available for each chatbot in each chat mode, with specific tool filtering and priority.

**Key Features**:
- **Unique constraint**: Prevents duplicate configurations for the same chatbot-MCP-mode combination
- **Tool filtering**: `allowedTools` array supports wildcards (e.g., "search*", "execute_*")
- **Priority system**: Lower numbers = higher priority for conflict resolution
- **Mode-specific**: Different configurations for tutor vs explainer vs other modes

### 3. Updated Chatbot Table

```prisma
model Chatbot {
  id String @id @default(uuid()) @db.Uuid

  name        String
  description String?
  avatar      String?

  // Existing system prompts per mode
  systemPrompts Json? // { tutor: {prompt: string; description: string}; explainer: {...}; ... }

  // NEW: Azure OpenAI Configuration
  azureOpenAIKey      String? @db.Text // Encrypted API key using APP_SECRET
  azureOpenAIEndpoint String?           // Optional custom endpoint (defaults to model config)

  // Relations
  mcpConfigurations ChatbotMCPConfig[]
  threads          ChatThread[]
  usageCredits     ChatUsageCredits[]

  owner   User   @relation(fields: [ownerId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  ownerId String @db.Uuid

  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  courseId String @db.Uuid

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Key Additions**:
- `azureOpenAIKey`: Encrypted per-chatbot Azure OpenAI API key
- `azureOpenAIEndpoint`: Optional custom Azure endpoint (overrides model configuration)
- `mcpConfigurations`: Relation to MCP configurations

## Implementation Plan

## ✅ Implementation Status (Updated: 2025-09-20)

### Core Features - COMPLETED ✅

**1. Database Schema Updates**
- ✅ `ChatbotMCPServer` model added - stores reusable MCP server definitions
- ✅ `ChatbotMCPConfig` junction table added - manages chatbot-MCP-mode relationships  
- ✅ `Chatbot` model updated - added Azure OpenAI fields and MCP configuration relations
- ✅ Prisma client generated successfully with new models
- ⏳ Database migration pending (requires DATABASE_URL configuration)

**2. Encryption Infrastructure**
- ✅ `apps/chat/src/lib/crypto.ts` created with AES-256-GCM encryption
- ✅ Uses existing APP_SECRET for key derivation 
- ✅ Safe encryption/decryption functions prevent double-encryption
- ✅ Format: `iv:authTag:encryptedData` for secure storage

**3. Multi-MCP Client Service**
- ✅ `apps/chat/src/services/mcpClients.ts` completely refactored
- ✅ Support for multiple MCP servers with priority-based loading
- ✅ Tool namespacing implemented (`RAG_MCP.search`, `Python_Executor.execute`)
- ✅ Wildcard tool filtering with patterns like `search*`, `*plot*`
- ✅ Authentication support for bearer, basic, and none auth types
- ✅ Graceful degradation when individual servers fail
- ✅ Backward compatibility with legacy environment variables

**4. Chat Route Handler Integration**
- ✅ `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` updated
- ✅ Database-driven MCP configuration loading
- ✅ Per-chatbot Azure OpenAI key support with environment fallback
- ✅ Mode-specific tool filtering (tutor vs explainer)
- ✅ Aggregated tool loading from multiple MCP servers

**5. Deployment Tools**
- ✅ `apps/chat/src/scripts/seed-mcp-servers.ts` created
- ✅ Seeds common MCP servers: RAG, Python, R, Web Search
- ✅ Example chatbot configurations for different modes
- ✅ Environment variable support for flexible deployment

### Implementation Quality Metrics ✅

- **Security**: All secrets encrypted at rest, no plaintext storage
- **Backward Compatibility**: Environment variables still work as fallback
- **Error Handling**: Graceful degradation when MCP servers fail
- **Performance**: Priority-based loading, tool namespacing prevents conflicts
- **Maintainability**: Clear separation of concerns, comprehensive logging

## 🔧 Discovered Improvements & Future Enhancements

### Robustness Improvements (Recommended)

**MCP Server Reliability**
- Add health check endpoints for MCP servers (`/health`, `/ready`)
- Implement connection pooling to reduce latency for frequent requests
- Add retry logic with exponential backoff for failed MCP calls
- Validate MCP server URLs and connectivity before storing in database
- Implement circuit breaker pattern for consistently failing servers

**Error Handling & Recovery**
- Add detailed error codes for different MCP failure scenarios
- Implement automatic failover to backup MCP servers of same type
- Add request/response logging for debugging MCP integration issues
- Create MCP server status dashboard for administrators

### Security Enhancements (Production Ready)

**Access Control & Monitoring**
- Add rate limiting per MCP server to prevent abuse
- Implement audit logging for all MCP tool usage with user attribution
- Add IP allowlisting configuration for MCP servers
- Consider implementing secret rotation mechanism for MCP credentials
- Add request signing/verification for critical MCP operations

**Data Protection**
- Encrypt MCP request/response data in transit (ensure TLS 1.3)
- Add data residency controls for cross-region MCP servers
- Implement request sanitization to prevent injection attacks via tool parameters

### Performance Optimizations (Scale Ready)

**Caching & Connection Management**
- Cache MCP tool definitions to reduce server discovery calls
- Implement lazy loading of MCP clients (connect only when needed)
- Add connection keep-alive for frequently used MCP servers
- Consider response caching for identical queries (with TTL)
- Implement request deduplication for concurrent identical tool calls

**Load Balancing & Scalability**
- Support multiple instances of same MCP server type with load balancing
- Add geographic routing for MCP servers (choose closest)
- Implement async tool execution for non-blocking operations
- Add MCP server capacity management and auto-scaling triggers

### Developer Experience Improvements

**Tooling & Debugging**
- Add MCP server testing utilities for development
- Create CLI tools for MCP server management and testing
- Implement MCP request/response inspection in development mode
- Add comprehensive logging with structured data for production debugging

**Configuration Management**
- Create admin UI for MCP server configuration (future enhancement)
- Add configuration validation and testing endpoints
- Implement configuration versioning and rollback capabilities
- Add bulk import/export tools for MCP configurations

### Phase 1: Database and Core Infrastructure

#### 1.1 Update Prisma Schema
**File**: `packages/prisma/src/prisma/schema/chat.prisma`

- Add the three new models shown above
- Ensure proper relationships and constraints
- Run `prisma generate` and `prisma migrate dev` to apply changes

#### 1.2 Create Encryption Utilities
**File**: `apps/chat/src/lib/crypto.ts`

```typescript
import crypto from 'crypto'

const algorithm = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const appSecret = process.env.APP_SECRET
  if (!appSecret) {
    throw new Error('APP_SECRET environment variable is required for encryption')
  }
  return crypto.createHash('sha256').update(appSecret).digest()
}

export function encrypt(text: string): string
export function decrypt(encryptedData: string): string
export function isEncrypted(value: string): boolean
```

**Key Features**:
- Uses existing `APP_SECRET` for encryption key derivation
- AES-256-GCM for authenticated encryption
- Format: `iv:authTag:encryptedData`
- Helper function to detect if a value is already encrypted

### Phase 2: MCP Client Service Updates

#### 2.1 Enhanced MCP Client Service
**File**: `apps/chat/src/services/mcpClients.ts`

**Current Functionality**: Single MCP server with global configuration
**New Functionality**: Multiple MCP servers with per-chatbot configuration

**Key Changes**:

```typescript
// New interfaces
interface MCPServerWithConfig {
  server: {
    id: string
    name: string
    url: string
    authType: string
    authSecret?: string
    parameters?: any
  }
  config: {
    allowedTools?: string[]
    parameters?: any
    priority: number
  }
}

// Updated functions
export async function createMCPClient(server: MCPServerConfig, chatbotId: string)
export async function getAggregatedMCPTools(serversWithConfigs: MCPServerWithConfig[], chatbotId: string)
```

**Priority System Implementation**:
1. Sort MCP servers by priority (ascending: 0, 1, 2...)
2. Load tools from each server in order
3. Namespace all tools: `{serverName}.{toolName}`
4. Continue loading even if one server fails

**Tool Filtering Implementation**:
- Support wildcard patterns: `search*`, `execute_*`, `*plot*`
- Empty or null `allowedTools` = all tools allowed
- Apply filtering before namespacing

### Phase 3: Chat Route Integration

#### 3.1 Update Chat Route Handler
**File**: `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`

**Key Changes**:

1. **Database Query Update**:
```typescript
const chatbot = await prisma.chatbot.findUnique({
  where: { id: chatbotId },
  include: {
    mcpConfigurations: {
      where: {
        chatMode: selectedMode,
        isEnabled: true,
      },
      include: {
        mcpServer: { where: { isActive: true } }
      },
      orderBy: { priority: 'asc' }
    }
  }
})
```

2. **Azure Configuration**:
```typescript
function getAzureModel(modelId: ModelID, chatbot: any): LanguageModel {
  const apiKey = chatbot?.azureOpenAIKey
    ? decrypt(chatbot.azureOpenAIKey)
    : process.env.AZURE_OPENAI_API_KEY

  const endpoint = chatbot?.azureOpenAIEndpoint ||
    getModelLink(modelId).split('/openai')[0]

  // Configure Azure SDK with decrypted key
}
```

3. **MCP Tool Loading**:
```typescript
const mcpServersWithConfigs = chatbot?.mcpConfigurations?.map(config => ({
  server: config.mcpServer,
  config: {
    allowedTools: config.allowedTools as string[] | undefined,
    parameters: config.parameters,
    priority: config.priority,
  }
})) || []

const mcpTools = await getAggregatedMCPTools(mcpServersWithConfigs, chatbotId)
```

## Configuration Examples

### Sample MCP Server Configurations

```sql
-- RAG MCP Server for course content
INSERT INTO "ChatbotMCPServer" (name, description, url, "authType", "authSecret", "isActive")
VALUES (
  'RAG_MCP',
  'Retrieval Augmented Generation for course content',
  'https://rag-mcp.example.com/mcp',
  'bearer',
  'encrypted:abc123...', -- encrypt('actual-rag-token')
  true
);

-- Python Code Execution MCP
INSERT INTO "ChatbotMCPServer" (name, description, url, "authType", "authSecret", "isActive")
VALUES (
  'Python_Executor',
  'Python code execution environment',
  'https://python-mcp.example.com/mcp',
  'bearer',
  'encrypted:def456...', -- encrypt('actual-python-token')
  true
);

-- R Statistical Computing MCP
INSERT INTO "ChatbotMCPServer" (name, description, url, "authType", "authSecret", "isActive")
VALUES (
  'R_Executor',
  'R statistical computing environment',
  'https://r-mcp.example.com/mcp',
  'bearer',
  'encrypted:ghi789...', -- encrypt('actual-r-token')
  true
);
```

### Sample Chatbot MCP Configurations

```sql
-- Statistics course chatbot configuration
-- Tutor mode: Full access to search, Python, and R
INSERT INTO "ChatbotMCPConfig" ("chatbotId", "mcpServerId", "chatMode", "allowedTools", priority, "isEnabled")
VALUES
  -- Primary: RAG for course content
  ('stats-chatbot-uuid', 'rag-mcp-uuid', 'tutor',
   '["search", "retrieve", "summarize"]', 0, true),

  -- Secondary: Python for demonstrations
  ('stats-chatbot-uuid', 'python-mcp-uuid', 'tutor',
   '["execute", "plot*", "analyze", "visualize*"]', 1, true),

  -- Tertiary: R for statistical analysis
  ('stats-chatbot-uuid', 'r-mcp-uuid', 'tutor',
   '["execute", "plot", "statistical_*", "regression", "anova"]', 2, true);

-- Explainer mode: Limited to search only
INSERT INTO "ChatbotMCPConfig" ("chatbotId", "mcpServerId", "chatMode", "allowedTools", priority, "isEnabled")
VALUES
  ('stats-chatbot-uuid', 'rag-mcp-uuid', 'explainer',
   '["search", "retrieve"]', 0, true);
```

### Sample Chatbot Azure Configuration

```sql
-- Chatbot with custom Azure OpenAI configuration
UPDATE "Chatbot"
SET
  "azureOpenAIKey" = 'encrypted:xyz789...', -- encrypt('sk-actual-azure-key')
  "azureOpenAIEndpoint" = 'https://custom-instance.openai.azure.com'
WHERE id = 'stats-chatbot-uuid';
```

## Tool Namespacing and Conflict Resolution

### How Namespacing Works

**Input**: Multiple MCP servers with overlapping tool names
```
RAG_MCP tools: ["search", "retrieve", "summarize"]
Python_Executor tools: ["execute", "plot", "analyze"]
R_Executor tools: ["execute", "plot", "statistical_test"]
```

**Output**: Namespaced tools in AI SDK
```javascript
{
  "RAG_MCP.search": { ... },
  "RAG_MCP.retrieve": { ... },
  "RAG_MCP.summarize": { ... },
  "Python_Executor.execute": { ... },
  "Python_Executor.plot": { ... },
  "Python_Executor.analyze": { ... },
  "R_Executor.execute": { ... },
  "R_Executor.plot": { ... },
  "R_Executor.statistical_test": { ... }
}
```

**Benefits**:
- No tool conflicts between MCP servers
- Clear indication of which MCP server provides each tool
- All tools remain available to the AI
- Easy to trace tool usage back to specific MCP servers

### Priority Usage Examples

**Scenario 1: Performance Optimization**
```javascript
// Fast local cache first, then slower external APIs
[
  { server: "Local_Cache", priority: 0 },     // ~1ms response
  { server: "RAG_MCP", priority: 1 },         // ~50ms response
  { server: "External_API", priority: 2 }     // ~200ms response
]
```

**Scenario 2: Cost Optimization**
```javascript
// Free services first, then paid services
[
  { server: "Free_RAG", priority: 0 },        // No cost
  { server: "Premium_Search", priority: 1 }   // $0.01 per request
]
```

**Scenario 3: Reliability Optimization**
```javascript
// Most stable services first
[
  { server: "Production_MCP", priority: 0 },  // 99.9% uptime
  { server: "Backup_MCP", priority: 1 },      // Fallback service
  { server: "Beta_MCP", priority: 2 }         // Experimental features
]
```

## Testing Strategy

### Unit Tests (Updated with Implementation Insights)

1. **Encryption/Decryption Tests**
   - Verify round-trip encryption works with APP_SECRET
   - Test with empty/null values and edge cases (empty strings, whitespace)
   - Test encryption with special characters and Unicode strings
   - Verify authentication tag validation prevents tampering
   - Test `isEncrypted()` function with various string formats
   - Test `safeEncrypt()` and `safeDecrypt()` prevent double-processing
   - Verify error handling when APP_SECRET is missing or invalid

2. **Tool Filtering Tests**
   - Test wildcard patterns (`search*`, `*plot*`, `execute_*`) with regex conversion
   - Test edge cases: patterns with multiple wildcards (`*search*plot*`)
   - Test case sensitivity (patterns should be case-insensitive)
   - Test exact matches vs partial matches
   - Test empty allowedTools (should allow all tools from server)
   - Test empty array vs null vs undefined allowedTools
   - Test blocking all tools from a server (empty results)
   - Test malformed patterns and ensure graceful handling

3. **Priority Sorting Tests**
   - Verify servers load in correct priority order (0, 1, 2...)
   - Test with equal priorities (should maintain stable sort order)
   - Test priority changes and re-sorting
   - Test priority gaps (0, 5, 10) work correctly
   - Test negative priorities (should still sort correctly)

4. **MCP Client Creation Tests**
   - Test different authentication types (bearer, basic, none)
   - Test URL validation and error handling
   - Test header construction for different auth types
   - Test concurrent client creation for multiple servers
   - Test client creation with missing or invalid credentials

5. **Tool Namespacing Tests**
   - Test namespace collision prevention (`RAG_MCP.search` vs `Python_Executor.search`)
   - Test namespace uniqueness across multiple servers
   - Test tool aggregation from multiple servers
   - Test graceful handling when servers have no tools

### Integration Tests (Enhanced with Implementation Insights)

1. **Multi-MCP Loading**
   - Configure chatbot with multiple MCP servers (RAG + Python + R)
   - Verify all tools are loaded and namespaced correctly
   - Test tool aggregation respects priority ordering
   - Test with different tool filters per server
   - Test partial server failures (some servers down, others working)
   - Verify empty MCP configurations fall back to legacy environment variables

2. **Mode-Specific Configurations**
   - Configure different MCP servers for tutor vs explainer modes
   - Verify correct tools are available in each mode
   - Test mode switching preserves chatbot context but changes available tools
   - Test chatbots with no MCP configurations (should use legacy fallback)

3. **Azure Configuration**
   - Test per-chatbot Azure keys with encryption/decryption
   - Test fallback to environment variables when chatbot has no custom key
   - Test custom Azure endpoints override model configuration URLs
   - Test Azure authentication with both encrypted and environment keys
   - Test malformed Azure endpoints and error handling
   - Test Azure SDK initialization with different resource names

4. **Error Handling & Resilience**
   - Test MCP server connection failures (network timeouts, 500 errors)
   - Test decryption failures (corrupted data, missing APP_SECRET)
   - Test invalid tool filters (malformed JSON, invalid patterns)
   - Test individual MCP server failures with continued operation of others
   - Test database connection failures during MCP configuration loading
   - Test invalid MCP server URLs and authentication failures
   - Verify graceful degradation to legacy environment variables
   - Test partial tool loading (some tools fail, others succeed)
   - Test concurrent MCP requests under failure conditions

### End-to-End Tests

1. **Chat Flow with MCPs**
   - Send chat message that triggers tool usage
   - Verify correct MCP server receives the request
   - Verify chatbot ID is passed to MCP server
   - Verify tool response is handled correctly

2. **RAG Integration Test**
   - Configure chatbot with RAG MCP
   - Send query that should trigger content search
   - Verify RAG MCP receives chatbot ID for filtering
   - Verify relevant content is returned

3. **Code Execution Test**
   - Configure chatbot with Python/R executor
   - Send request for code execution
   - Verify code runs in isolated environment
   - Verify results are returned to chat

## 🚀 Migration Guide (Production Deployment)

### Prerequisites

**Environment Requirements**
- APP_SECRET configured (required for encryption)
- DATABASE_URL configured for Prisma migrations
- Existing MCP server endpoints available
- Azure OpenAI credentials (can remain in environment variables initially)

**Pre-Migration Checklist**
- [ ] Backup existing database
- [ ] Test encryption utilities in staging environment
- [ ] Verify MCP server connectivity and credentials
- [ ] Document current chatbot configurations
- [ ] Plan rollback strategy if needed

### Step 1: Deploy Code Changes (Zero Downtime)

```bash
# 1. Deploy application with new code (backward compatible)
git checkout main
git pull origin main

# 2. Build and deploy chat application
cd apps/chat
pnpm build
# Deploy using your deployment strategy (Docker, K8s, etc.)
```

**Verification**: Existing chatbots should continue working with environment variables.

### Step 2: Database Migration

```bash
# 1. Run Prisma migration
cd packages/prisma
export DATABASE_URL="your-production-database-url"
pnpm prisma migrate deploy --preview-feature

# 2. Verify new tables exist
pnpm prisma studio
# Check: ChatbotMCPServer, ChatbotMCPConfig tables created
```

**Verification**: Database contains new tables with proper relationships.

### Step 3: Seed Initial MCP Servers

```bash
# 1. Set environment variables for your MCP servers
export RAG_MCP_URL="https://your-rag-mcp.com/mcp"
export RAG_MCP_SECRET="your-encrypted-rag-token"
export PYTHON_MCP_URL="https://your-python-mcp.com/mcp" 
export PYTHON_MCP_SECRET="your-encrypted-python-token"

# 2. Run seeding script
cd apps/chat
npx tsx src/scripts/seed-mcp-servers.ts

# 3. Verify MCP servers created
# Check database: SELECT * FROM "ChatbotMCPServer";
```

**Verification**: MCP servers appear in database with encrypted secrets.

### Step 4: Test Configuration (Single Chatbot)

```sql
-- 1. Find a test chatbot ID
SELECT id, name FROM "Chatbot" LIMIT 1;

-- 2. Configure MCP server for test chatbot
INSERT INTO "ChatbotMCPConfig" 
("chatbotId", "mcpServerId", "chatMode", "allowedTools", "priority", "isEnabled")
VALUES 
('your-test-chatbot-id', 
 (SELECT id FROM "ChatbotMCPServer" WHERE name = 'RAG_MCP'), 
 'tutor', 
 '["search", "retrieve"]', 
 0, 
 true);
```

**Verification**: Test chatbot uses new database configuration, others use environment variables.

### Step 5: Gradual Migration (Per Chatbot)

```sql
-- For each chatbot, add MCP configurations
-- Example: Statistics course chatbot
INSERT INTO "ChatbotMCPConfig" 
("chatbotId", "mcpServerId", "chatMode", "allowedTools", "priority", "isEnabled")
VALUES 
-- RAG for content search (highest priority)
('stats-chatbot-id', 'rag-server-id', 'tutor', '["search", "retrieve", "summarize"]', 0, true),
-- Python for demonstrations
('stats-chatbot-id', 'python-server-id', 'tutor', '["execute", "plot*", "analyze"]', 1, true),
-- Limited tools for explainer mode
('stats-chatbot-id', 'rag-server-id', 'explainer', '["search"]', 0, true);
```

**Verification**: Migrate 1-2 chatbots per day, monitor for issues.

### Step 6: Monitor and Validate

**Monitor These Metrics**:
- Chat response times (should remain < 2 seconds)
- MCP server connection success rates (> 99%)
- Error rates in application logs
- User-reported issues with chat functionality

**Validation Checklist**:
- [ ] All migrated chatbots respond correctly
- [ ] Different tools available in tutor vs explainer modes
- [ ] Tool namespacing works (no conflicts)
- [ ] Environment variable fallback still works for unmigrated chatbots
- [ ] Azure OpenAI keys work (environment variables initially)

### Step 7: Migrate Azure OpenAI Keys (Optional)

```sql
-- For chatbots needing custom Azure keys
UPDATE "Chatbot" 
SET 
  "azureOpenAIKey" = 'your-encrypted-azure-key',
  "azureOpenAIEndpoint" = 'https://custom-instance.openai.azure.com'
WHERE id = 'specific-chatbot-id';
```

**Note**: Only migrate Azure keys if you need per-chatbot customization.

### Step 8: Complete Migration

**Final Steps**:
- Verify all production chatbots have MCP configurations
- Remove unused environment variables (MCP_URL, MCP_KEY) if desired
- Update documentation for team members
- Archive legacy configuration notes

**Rollback Plan** (if needed):
- Remove MCP configurations from database
- Application automatically falls back to environment variables
- No downtime required for rollback

### Common Issues and Solutions

**Issue**: "MCP server connection failed"
**Solution**: Check MCP server URL and credentials in database

**Issue**: "No tools available for chatbot"
**Solution**: Verify ChatbotMCPConfig exists for the chatbot and mode

**Issue**: "Encryption/decryption failed"
**Solution**: Verify APP_SECRET is consistent across all instances

**Issue**: "Tools not filtered correctly"
**Solution**: Check allowedTools JSON format and wildcard patterns

## 📊 Operational Considerations (Production Operations)

### Monitoring & Alerting

**Key Metrics to Monitor**
- **MCP Server Health**: Response times, success rates, connection failures
- **Tool Usage**: Most used tools, tool failure rates, usage patterns per chatbot
- **Azure OpenAI**: Token consumption, API response times, rate limit hits
- **Database Performance**: Query times for MCP configuration loading
- **Encryption Performance**: Time to decrypt secrets, cache hit rates

**Recommended Alerts**
- MCP server connection failure rate > 5%
- Chat response time > 3 seconds (95th percentile)
- Azure OpenAI API errors > 1%
- Database query times > 500ms for MCP config loading
- Encryption/decryption failures

**Sample Monitoring Queries** (adjust for your monitoring system)
```javascript
// MCP server success rate
sum(rate(mcp_requests_total{status="success"}[5m])) / 
sum(rate(mcp_requests_total[5m])) * 100

// Chat response time p95
histogram_quantile(0.95, 
  sum(rate(chat_response_duration_seconds_bucket[5m])) by (le)
)

// Tool usage by server
sum(rate(mcp_tool_calls_total[1h])) by (mcp_server, tool_name)
```

### Logging & Debugging

**Structured Logging Fields**
- `chatbotId`: For tracing chatbot-specific issues
- `mcpServerName`: Which MCP server was called
- `toolName`: Specific tool being used (namespaced)
- `userId`: For user-specific debugging
- `requestId`: For tracing request flow
- `responseTime`: Performance tracking

**Log Levels by Scenario**
- INFO: Successful MCP tool calls, configuration loading
- WARN: MCP server fallbacks, retry attempts, deprecated features
- ERROR: MCP connection failures, encryption errors, invalid configurations
- DEBUG: Detailed request/response data (development only)

**Debug Mode Settings** (for development)
```env
# Enable detailed MCP request/response logging
DEBUG_MCP_REQUESTS=true
# Log decrypted secrets (NEVER in production)
DEBUG_SHOW_SECRETS=false
# Trace tool filtering decisions
DEBUG_TOOL_FILTERING=true
```

### Security Operations

**Secret Rotation Procedures**
1. Generate new MCP server credentials
2. Update MCP server configurations in database (encrypted)
3. Test with one chatbot before full rollout
4. Revoke old credentials from MCP servers
5. Monitor for authentication failures

**Encryption Key Management**
- APP_SECRET rotation requires re-encryption of all secrets
- Plan for gradual re-encryption during rotation
- Test decryption in staging before production deployment
- Consider external key management systems for enhanced security

**Access Control Auditing**
- Log all database changes to MCP configurations
- Monitor unusual tool usage patterns
- Alert on new MCP servers being added to database
- Regular review of chatbot MCP assignments

### Performance Optimization

**Connection Pooling** (recommended implementation)
- Maintain persistent connections to frequently used MCP servers
- Pool size: 5-10 connections per MCP server
- Connection timeout: 30 seconds
- Idle timeout: 5 minutes

**Caching Strategy**
- Cache MCP tool definitions for 5-10 minutes
- Cache chatbot MCP configurations for 1-2 minutes
- Cache decrypted secrets for request duration only
- Use Redis or in-memory cache for production

**Database Optimization**
- Index on `(chatbotId, chatMode)` for fast MCP config lookup
- Index on `mcpServerId` for cascade operations
- Monitor query performance for MCP config loading
- Consider read replicas for high-traffic scenarios

### Capacity Planning

**MCP Server Scaling**
- Monitor concurrent connections per MCP server
- Plan for horizontal scaling of popular MCP servers
- Consider geographic distribution for global deployments
- Load test MCP servers under peak chat usage

**Database Scaling**
- Plan for growth in ChatbotMCPConfig records (N chatbots × M modes × P servers)
- Monitor storage for encrypted secrets
- Consider archiving old configurations
- Plan for read replica deployment

### Disaster Recovery

**Backup Procedures**
- Include new tables in existing database backup procedures
- Test restoration of MCP configurations
- Backup MCP server credentials separately (encrypted)
- Document manual fallback to environment variables

**Recovery Scenarios**
- **MCP Server Outage**: Automatic fallback to secondary servers (if configured)
- **Database Outage**: Application falls back to environment variables
- **Encryption Key Loss**: Requires re-encryption of all secrets
- **Complete System Failure**: Environment variables allow basic functionality

### Team Operations

**Runbook Sections to Update**
- MCP server configuration procedures
- Chatbot deployment with MCP requirements
- Troubleshooting chat response failures
- Emergency procedures for MCP outages

**Required Team Knowledge**
- Understanding of MCP server architecture
- Database schema for MCP configurations
- Encryption/decryption procedures
- Tool namespacing and filtering concepts

**On-Call Procedures**
- Escalation path for MCP server failures
- Emergency contacts for MCP server providers
- Procedure for disabling problematic MCP servers
- Rollback procedures for failed deployments

## Rollout Plan

### Phase 1: Database Preparation (Day 1)
1. Deploy Prisma schema changes to staging
2. Run database migration
3. Verify new tables are created correctly
4. Test encryption utilities

### Phase 2: Service Updates (Day 2-3)
1. Deploy updated MCP client service
2. Deploy updated chat route handler
3. Test with minimal configuration (single MCP server)
4. Verify backward compatibility with environment variables

### Phase 3: Initial Configuration (Day 4)
1. Seed database with initial MCP server configurations
2. Configure one test chatbot with new system
3. Test all chat modes work correctly
4. Verify tool filtering and namespacing

### Phase 4: Gradual Migration (Week 2)
1. Migrate additional chatbots to new system
2. Monitor performance and error rates
3. Gather feedback from users
4. Adjust configurations as needed

### Phase 5: Full Rollout (Week 3-4)
1. Migrate all remaining chatbots
2. Remove dependency on environment variables
3. Update documentation
4. Monitor system stability

## Security Considerations

### Data Protection
- All secrets encrypted at rest using APP_SECRET
- No plaintext API keys or tokens in database
- Decryption only happens at runtime when needed
- Encrypted values not logged

### Access Control
- MCP server configurations require database access
- No API endpoints for modifying MCP configurations (intentionally hardcoded)
- Chatbot owners cannot modify MCP configurations
- Course enrollment required for chatbot access

### Audit Trail
- All database changes logged with timestamps
- MCP tool usage can be tracked per chatbot
- Authentication failures logged for monitoring
- Performance metrics tracked per MCP server

### Key Management
- APP_SECRET must be consistently deployed across all instances
- Backup/restore procedures must account for encryption
- Key rotation requires re-encryption of all secrets
- Consider external key management for production

## Environment Variables

### Required (Existing)
```env
APP_SECRET=your-existing-app-secret  # Used for JWT and encryption
```

### Optional (Fallbacks)
```env
# Fallback Azure configuration
AZURE_OPENAI_API_KEY=fallback-azure-key

# Fallback MCP configuration (for development/testing)
MCP_URL=https://fallback-mcp.example.com
MCP_KEY=fallback-mcp-key
```

### Development/Seeding
```env
# Used by seeding scripts to encrypt initial secrets
RAG_MCP_URL=https://rag-mcp.example.com
RAG_MCP_SECRET=your-rag-token

PYTHON_MCP_URL=https://python-mcp.example.com
PYTHON_MCP_SECRET=your-python-token

R_MCP_URL=https://r-mcp.example.com
R_MCP_SECRET=your-r-token
```

## Migration Notes

### Database Migration
- Prisma will automatically generate migration files
- No manual SQL required
- Existing chatbots will not be affected during migration
- New fields are nullable and have sensible defaults

### Configuration Migration
- Existing environment-based MCP configuration remains as fallback
- Existing Azure configuration remains as fallback
- Gradual migration allows testing before full switchover
- Old configuration can be removed after successful migration

### Data Seeding
- Initial MCP servers can be seeded with environment variables
- Encryption happens during seeding process
- Test configurations can be added for development
- Production configurations added after testing

## Files Modified (Implementation Complete)

### New Files Created ✅
1. **`apps/chat/src/lib/crypto.ts`** - Encryption utilities
   - AES-256-GCM encryption using existing APP_SECRET
   - Functions: encrypt(), decrypt(), isEncrypted(), safeEncrypt(), safeDecrypt()
   - Format: `iv:authTag:encryptedData` for secure storage

2. **`apps/chat/src/scripts/seed-mcp-servers.ts`** - MCP server seeding script
   - Seeds common MCP servers: RAG, Python, R, Web Search
   - Encrypts secrets before database storage
   - Example chatbot configurations for different modes
   - Environment variable support for flexible deployment

### Modified Files ✅
1. **`packages/prisma/src/prisma/schema/chat.prisma`** - Database schema updates
   - Added `ChatbotMCPServer` model for reusable MCP server definitions
   - Added `ChatbotMCPConfig` junction table for chatbot-MCP-mode relationships
   - Updated `Chatbot` model with Azure OpenAI fields and MCP relations
   - All relationships and constraints properly defined

2. **`apps/chat/src/services/mcpClients.ts`** - Complete multi-MCP refactor
   - Support for multiple MCP servers with priority-based loading
   - Tool namespacing to prevent conflicts (`RAG_MCP.search`, `Python_Executor.execute`)
   - Wildcard tool filtering with patterns like `search*`, `*plot*`
   - Authentication support for bearer, basic, and none auth types
   - Graceful degradation when individual servers fail
   - Backward compatibility with legacy environment variables

3. **`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`** - Database integration
   - Updated chatbot query to include MCP configurations and Azure fields
   - Per-chatbot Azure OpenAI key support with environment fallback
   - Mode-specific tool filtering (tutor vs explainer)
   - Aggregated tool loading from multiple MCP servers
   - Maintained backward compatibility during transition

### Implementation Notes
- **Database Migration**: Requires `pnpm prisma migrate dev` when DATABASE_URL is configured
- **Backward Compatibility**: All existing functionality preserved with environment variable fallbacks
- **Security**: All secrets encrypted at rest, no plaintext storage
- **Performance**: Priority-based loading, tool namespacing prevents conflicts
- **Error Handling**: Graceful degradation when MCP servers fail

## Success Metrics

### Technical Metrics
- Chat response time with multiple MCPs < 2 seconds
- MCP connection success rate > 99%
- Zero tool naming conflicts
- Database query performance within acceptable limits

### Functional Metrics
- Different tools available in tutor vs explainer modes
- RAG MCP correctly filters content by chatbot
- Code execution MCPs work reliably
- Per-chatbot Azure keys function correctly

### Security Metrics
- No plaintext secrets in database
- Successful encryption/decryption of all stored secrets
- No unauthorized access to MCP configurations
- Audit trail for all configuration changes

## 🔗 Custom Header Authentication & Chatbot Context

### Authentication Pattern Extension

**Current Limitation**: Only supports bearer/basic/none authentication types  
**Enhancement**: Support custom headers and conditional chatbot ID passing

### 1. Extended ChatbotMCPServer Schema

Add two new fields to support flexible authentication and chatbot context:

```prisma
model ChatbotMCPServer {
  // ... existing fields ...
  
  authType    String  // 'bearer' | 'basic' | 'none' | 'custom'
  authSecret  String? @db.Text // Encrypted - can be token OR JSON for custom headers
  
  // NEW: Control chatbot context passing
  passChatbotId Boolean @default(false) // Whether to include chatbot ID as header
  chatbotIdHeader String? // Header name for chatbot ID (default: 'Chatbot-ID')
  
  // ... rest of model ...
}
```

### 2. Authentication Formats

#### Standard Authentication (existing)
- **Bearer**: `authSecret = "token123"` → `Authorization: Bearer token123`
- **Basic**: `authSecret = "user:pass"` → `Authorization: Basic base64(user:pass)`
- **None**: No authentication headers

#### Custom Headers (new)
- **authType**: `"custom"`
- **authSecret**: Encrypted JSON string containing headers object

```json
{
  "headers": {
    "CONTEXT7_API_KEY": "api-key-value",
    "X-API-Version": "v1",
    "X-Custom-Header": "custom-value"
  }
}
```

### 3. Chatbot ID Passing Strategy

**Use Cases**:
- RAG MCP needs chatbot ID for content filtering
- Logging/analytics MCPs need chatbot context  
- Multi-tenant MCPs need isolation

**Configuration**:
- `passChatbotId: true` - Include chatbot ID in headers
- `chatbotIdHeader: "X-Chatbot-ID"` - Custom header name (optional)
- Default header name: `"Chatbot-ID"`

### 4. MCP Client Implementation Approach

```typescript
function createAuthHeaders(server: MCPServerConfig, chatbotId: string): Record<string, string> {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Add chatbot ID if configured
  if (server.passChatbotId) {
    const headerName = server.chatbotIdHeader || 'Chatbot-ID'
    baseHeaders[headerName] = chatbotId
  }

  // Handle authentication based on type
  switch (server.authType) {
    case 'custom':
      // Parse and apply custom headers
      const decrypted = safeDecrypt(server.authSecret)
      const { headers } = JSON.parse(decrypted)
      Object.assign(baseHeaders, headers)
      break
    case 'bearer':
      // ... existing bearer logic
    case 'basic':
      // ... existing basic logic
    case 'none':
    default:
      // No additional auth headers
  }

  return baseHeaders
}
```

### 5. Seeding Strategy for Development

#### Context7 MCP Example
```typescript
{
  name: 'Context7_MCP',
  description: 'Context7 documentation lookup service',
  url: 'https://mcp.context7.com/mcp',
  authType: 'custom',
  authSecret: encrypt(JSON.stringify({
    headers: {
      'CONTEXT7_API_KEY': process.env.CONTEXT7_API_KEY || 'demo-key'
    }
  })),
  passChatbotId: false, // Context7 doesn't need chatbot ID
  chatbotIdHeader: null,
  isActive: true
}
```

#### RAG MCP Example (needs chatbot context)
```typescript
{
  name: 'RAG_MCP',
  description: 'Course content retrieval system',
  url: 'https://rag.example.com/mcp',
  authType: 'bearer',
  authSecret: encrypt('rag-api-token'),
  passChatbotId: true, // RAG needs to filter by chatbot
  chatbotIdHeader: 'X-Chatbot-Context', // Custom header name
  isActive: true
}
```

### 6. Configuration Examples

#### MCP that needs both custom auth AND chatbot ID:
```json
{
  "name": "Analytics_MCP",
  "authType": "custom", 
  "authSecret": "{\"headers\": {\"X-API-Key\": \"key123\", \"X-Tenant\": \"klicker\"}}",
  "passChatbotId": true,
  "chatbotIdHeader": "X-Chatbot-ID"
}
```

**Result headers sent to MCP:**
- `Content-Type: application/json`
- `X-API-Key: key123`  
- `X-Tenant: klicker`
- `X-Chatbot-ID: <actual-chatbot-id>`

### 7. Migration for Existing MCPs

For existing MCP configurations:
- Set `passChatbotId: true` for current behavior (maintaining backward compatibility)
- Set `authType: 'bearer'` for standard token auth
- No changes needed to authSecret format
- Add database migration to set default values

### 8. Benefits

- **Flexibility**: Support any authentication scheme
- **Context-aware**: MCPs can filter/customize based on chatbot
- **Backward compatible**: Existing configs continue working  
- **Secure**: All secrets remain encrypted
- **Extensible**: Easy to add new auth patterns

## Future Enhancements

### Management Interface
- Admin UI for managing MCP servers
- Chatbot owner interface for viewing tool availability
- Usage analytics per MCP server
- Health monitoring dashboard

### Advanced Features
- Dynamic tool discovery from MCP servers
- A/B testing of different MCP configurations
- Cost tracking per MCP server per chatbot
- Automatic failover between MCP servers

### Integration Improvements
- MCP server health checks
- Circuit breaker pattern for failing servers
- Caching layer for frequently used tools
- Load balancing across multiple instances of same MCP type

This implementation plan provides a comprehensive roadmap for enhancing the chatbot system with configurable MCP servers and per-chatbot Azure keys while maintaining security, performance, and reliability standards.