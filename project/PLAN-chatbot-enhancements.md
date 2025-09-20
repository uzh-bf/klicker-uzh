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

### Unit Tests

1. **Encryption/Decryption Tests**
   - Verify round-trip encryption works
   - Test with empty/null values
   - Verify authentication tag validation

2. **Tool Filtering Tests**
   - Test wildcard patterns (`search*`, `*plot*`, `execute_*`)
   - Test exact matches
   - Test empty allowedTools (should allow all)
   - Test blocking all tools from a server

3. **Priority Sorting Tests**
   - Verify servers load in correct priority order
   - Test with equal priorities (should maintain stable order)
   - Test priority changes

### Integration Tests

1. **Multi-MCP Loading**
   - Configure chatbot with multiple MCP servers
   - Verify all tools are loaded and namespaced correctly
   - Test with different tool filters per server

2. **Mode-Specific Configurations**
   - Configure different MCP servers for tutor vs explainer modes
   - Verify correct tools are available in each mode
   - Test mode switching

3. **Azure Configuration**
   - Test per-chatbot Azure keys
   - Test fallback to environment variables
   - Test custom Azure endpoints

4. **Error Handling**
   - Test MCP server connection failures
   - Test decryption failures
   - Test invalid tool filters
   - Verify graceful degradation

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

## Files Modified

### New Files
1. `apps/chat/src/lib/crypto.ts` - Encryption utilities
2. `project/PLAN-chatbot-enhancements.md` - This document

### Modified Files
1. `packages/prisma/src/prisma/schema/chat.prisma` - Add new models
2. `apps/chat/src/services/mcpClients.ts` - Multi-MCP support
3. `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` - Use database configurations

### Configuration Files
1. `apps/chat/.env.example` - Document new optional variables

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