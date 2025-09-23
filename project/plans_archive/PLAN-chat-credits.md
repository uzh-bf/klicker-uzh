# Chatbot Credits System Enhancement Plan

## Current System Analysis

### Existing Structure

- `ChatUsageCredits` model tracks credits per participant-chatbot pair
- Credits are decremented when AI responses consume tokens via `CreditsService.decrementCredits()`
- Current implementation initializes new users with **0 credits** (critical gap)
- No automatic reset or refill mechanism exists
- Frontend displays credit progress bar and switches available models based on credit balance

### Identified Issues

1. **New User Experience**: Students joining a course get 0 credits, blocking immediate access
2. **No Reset Mechanism**: Once credits are consumed, users cannot get more without manual intervention
3. **Missing Configuration**: No way to configure credit policies per chatbot
4. **No Periodic Refresh**: No support for "X credits per week/month" scenarios

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Extend Chatbot Model

Add `creditSettings` JSON field to the `Chatbot` model:

```prisma
model Chatbot {
  // ... existing fields

  // Credit configuration per chatbot
  creditSettings Json? // {
    // initialCredits: 100,
    // resetPeriod: 'weekly',
    // resetAmount: 50,
    // maxCredits: 100
    // }
}
```

**Credit Settings Schema:**

```typescript
interface CreditSettings {
  initialCredits: number // Credits given to new users
  resetPeriod: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'none'
  resetAmount: number // Credits restored on reset
  maxCredits: number // Maximum credits (for partial resets)
}
```

#### 1.2 Extend ChatUsageCredits Model

Add tracking fields for reset management:

```prisma
model ChatUsageCredits {
  // ... existing fields

  // Reset tracking
  periodStartedAt DateTime? // When current credit period began
  lastResetAt     DateTime? // Last time credits were reset
  resetCount      Int       @default(0) // Number of resets performed
}
```

### Phase 2: Credit Initialization System

#### 2.1 Update CreditsService.getUserCredits()

Current behavior creates 0 credits for new users. Enhanced logic:

```typescript
static async getUserCredits(
  participantId: string,
  chatbotId: string
): Promise<UserCredits> {
  let credits = await prisma.chatUsageCredits.findUnique({
    where: { participantId_chatbotId: { participantId, chatbotId } }
  })

  if (!credits) {
    // Initialize with chatbot's default settings
    credits = await this.initializeCredits(participantId, chatbotId)
  } else {
    // Check if reset is needed
    credits = await this.checkAndResetCredits(credits, chatbotId)
  }

  return {
    current: credits.current.toNumber(),
    total: credits.total.toNumber()
  }
}
```

#### 2.2 Create CreditsService.initializeCredits()

```typescript
static async initializeCredits(
  participantId: string,
  chatbotId: string
): Promise<ChatUsageCredits> {
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { creditSettings: true }
  })

  const settings = chatbot?.creditSettings as CreditSettings | null
  const initialAmount = settings?.initialCredits ?? 10 // default fallback

  return await prisma.chatUsageCredits.create({
    data: {
      participantId,
      chatbotId,
      total: initialAmount,
      current: initialAmount,
      periodStartedAt: new Date(),
      lastResetAt: new Date(),
      resetCount: 0
    }
  })
}
```

### Phase 3: Periodic Reset Mechanism

#### 3.1 Reset Period Calculations

```typescript
enum ResetPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
  NONE = 'none'
}

static shouldResetCredits(
  lastResetAt: Date,
  resetPeriod: ResetPeriod
): boolean {
  const now = new Date()
  const timeDiff = now.getTime() - lastResetAt.getTime()

  switch (resetPeriod) {
    case ResetPeriod.DAILY:
      return timeDiff >= 24 * 60 * 60 * 1000 // 24 hours
    case ResetPeriod.WEEKLY:
      return timeDiff >= 7 * 24 * 60 * 60 * 1000 // 7 days
    case ResetPeriod.BIWEEKLY:
      return timeDiff >= 14 * 24 * 60 * 60 * 1000 // 14 days
    case ResetPeriod.MONTHLY:
      // Reset on same day of month (e.g., every 1st of month)
      const lastResetMonth = lastResetAt.getMonth()
      const currentMonth = now.getMonth()
      return lastResetMonth !== currentMonth ||
             (now.getFullYear() > lastResetAt.getFullYear())
    case ResetPeriod.NONE:
    default:
      return false
  }
}
```

#### 3.2 Credit Reset Logic

```typescript
static async checkAndResetCredits(
  existingCredits: ChatUsageCredits,
  chatbotId: string
): Promise<ChatUsageCredits> {
  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { creditSettings: true }
  })

  const settings = chatbot?.creditSettings as CreditSettings | null
  if (!settings || settings.resetPeriod === 'none') {
    return existingCredits
  }

  const shouldReset = this.shouldResetCredits(
    existingCredits.lastResetAt || existingCredits.createdAt,
    settings.resetPeriod as ResetPeriod
  )

  if (shouldReset) {
    return await prisma.chatUsageCredits.update({
      where: { id: existingCredits.id },
      data: {
        current: Math.min(
          existingCredits.current.toNumber() + settings.resetAmount,
          settings.maxCredits
        ),
        total: settings.maxCredits,
        lastResetAt: new Date(),
        resetCount: existingCredits.resetCount + 1
      }
    })
  }

  return existingCredits
}
```

### Phase 4: API Updates

#### 4.1 Enhanced GET /api/chatbots/[chatbotId]/credits

The existing endpoint automatically handles resets through updated `getUserCredits()`:

```typescript
// No changes needed - existing code will work with enhanced service
const credits = await CreditsService.getUserCredits(
  participantId as string,
  chatbotId
)
```

#### 4.2 Optional: GET /api/chatbots/[chatbotId]/credit-info

New endpoint to provide credit policy information:

```typescript
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ chatbotId: string }> }
) {
  const { chatbotId } = await params

  const chatbot = await prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { creditSettings: true },
  })

  const settings = chatbot?.creditSettings as CreditSettings | null

  return NextResponse.json({
    resetPeriod: settings?.resetPeriod || 'none',
    initialCredits: settings?.initialCredits || 10,
    resetAmount: settings?.resetAmount || 10,
    maxCredits: settings?.maxCredits || 10,
  })
}
```

### Phase 5: Frontend Updates

#### 5.1 Enhanced Settings Panel

Update `settings-panel.tsx` to show reset information:

```typescript
// Add to SettingsState interface
interface SettingsState {
  // ... existing fields
  creditInfo: {
    resetPeriod: string
    timeUntilReset?: string
  }
  loadCreditInfo: (chatbotId: string) => Promise<void>
}

// In component
{credits.current === 0 ? (
  <div className="text-muted-foreground text-sm">
    You have used up all your credits.
    {creditInfo.resetPeriod !== 'none' && (
      <span>Credits refresh {creditInfo.timeUntilReset}</span>
    )}
  </div>
) : null}
```

#### 5.2 Credit Progress Enhancements

- Show "Refreshes in X days" tooltip
- Add visual indicator for reset schedule
- Display credit refresh countdown

### Phase 6: Migration Strategy

#### 6.1 Database Migration

```sql
-- Add creditSettings to existing chatbots with defaults
UPDATE "Chatbot"
SET "creditSettings" = '{"initialCredits": 10, "resetPeriod": "weekly", "resetAmount": 10, "maxCredits": 10}'
WHERE "creditSettings" IS NULL;

-- Add tracking fields to existing credit records
ALTER TABLE "ChatUsageCredits"
ADD COLUMN "periodStartedAt" TIMESTAMP,
ADD COLUMN "lastResetAt" TIMESTAMP,
ADD COLUMN "resetCount" INTEGER DEFAULT 0;

-- Initialize tracking for existing records
UPDATE "ChatUsageCredits"
SET "periodStartedAt" = "createdAt",
    "lastResetAt" = "createdAt"
WHERE "periodStartedAt" IS NULL;
```

#### 6.2 Existing User Credits

Options for users with 0 credits:

1. **Immediate Boost**: Set current credits to initial amount
2. **Next Reset**: Wait for next reset period
3. **Hybrid**: Partial credits now, full reset on schedule

### Phase 7: Configuration Examples

#### 7.1 Common Credit Policies

```json
// Conservative daily allowance
{
  "initialCredits": 5,
  "resetPeriod": "daily",
  "resetAmount": 5,
  "maxCredits": 5
}

// Weekly batch with accumulation
{
  "initialCredits": 20,
  "resetPeriod": "weekly",
  "resetAmount": 15,
  "maxCredits": 30
}

// Monthly research allowance
{
  "initialCredits": 100,
  "resetPeriod": "monthly",
  "resetAmount": 100,
  "maxCredits": 100
}
```

## Implementation Order

1. **Database Schema** - Add new fields to models
2. **Service Layer** - Enhance CreditsService with reset logic
3. **API Layer** - Update existing endpoints to use new service methods
4. **Frontend** - Add reset period display and improved messaging
5. **Migration** - Update existing data with defaults
6. **Testing** - Comprehensive testing of reset scenarios

## Testing Strategy

### Unit Tests

- Reset period calculation accuracy
- Credit initialization with various settings
- Reset logic with edge cases (month boundaries, leap years)

### Integration Tests

- Full credit lifecycle from initialization to reset
- API endpoint behavior with different configurations
- Database consistency during resets

### E2E Tests

- New user onboarding with credits
- Credit consumption and reset user flows
- Frontend display accuracy

## Deployment Considerations

- **Zero Downtime**: Schema changes are additive
- **Gradual Rollout**: Can deploy with existing behavior first
- **Monitoring**: Track reset frequency and user engagement
- **Rollback Plan**: Default settings preserve current behavior

## Future Enhancements

1. **Credit Earning**: Users earn credits through course activities
2. **Credit Trading**: Transfer credits between participants
3. **Advanced Policies**: Time-of-day restrictions, bonus periods
4. **Analytics**: Credit usage patterns and optimization
