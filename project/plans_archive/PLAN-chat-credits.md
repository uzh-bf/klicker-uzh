# Chatbot Credits System Enhancement Plan

## Current System Analysis

## Progress (feat/chat-gpt-5-1)

**Done on this branch**
- Persisted and displayed per-message `creditsUsed` (computed from token usage), enabling cost auditing per assistant response.
- Credits initialization/reset exists server-side via scalar chatbot fields + fixed-period logic (this differs from the JSON sketch in this doc).
- Credits endpoint now enforces course membership (403 for non-members).

**Remaining**
- Reconcile this plan with the current implementation so it matches reality.
- With course↔chatbot many-to-many, decide whether credits are per chatbot or per course↔chatbot context; update schema/unique keys accordingly if per-course.

### Existing Structure

- `ChatUsageCredits` tracks credits per `(participantId, chatbotId)`.
- Credits are initialized and reset via fixed-period logic in `apps/chat/src/services/credits.ts`.
- Credit policy is stored on `Chatbot` as scalar fields: `creditInitialCredits`, `creditResetPeriod`, `creditResetAmount`, `creditMaxCredits`.
- Atomic helpers in `apps/chat/src/utils/transactions.ts` avoid race conditions.
- Frontend uses `/api/chatbots/<chatbotId>/credits` to load `availableModels` + `automaticModelId`.

### Identified Issues

1. **Plan/documentation drift**: this document still describes a JSON-based configuration that is no longer used.
2. **Course↔chatbot N:N**: credits are currently chatbot-scoped; keep as-is or decide on course-scoped credits if policy differs by course.

## Implementation Plan

### Phase 1: Database Schema Updates

#### 1.1 Current Chatbot Credit Fields

Credit policy is defined via scalar fields on `Chatbot`:

```prisma
creditInitialCredits Int
creditResetPeriod    CreditResetPeriod
creditResetAmount    Int
creditMaxCredits     Int
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

#### 2.1 Current CreditsService behavior

See `apps/chat/src/services/credits.ts`:
- Initializes credits using fixed period alignment (`getCurrentPeriodStart`).
- Uses atomic helpers for initialize/reset/decrement.
- Resets happen when `isPeriodExpired()` returns true.

#### 2.2 Atomic helpers (current)

See `apps/chat/src/utils/transactions.ts` for:
- `atomicInitializeCredits`
- `atomicResetCreditsIfNeeded`
- `atomicDecrementCredits`

### Phase 3: Periodic Reset Mechanism

#### 3.1 Reset Period Calculations (current)

Implemented in `apps/chat/src/utils/creditPeriods.ts` with fixed period alignment.

#### 3.2 Credit Reset Logic (current)

Handled inside `atomicResetCreditsIfNeeded` using fixed-period checks.

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
    select: {
      creditResetPeriod: true,
      creditInitialCredits: true,
      creditResetAmount: true,
      creditMaxCredits: true,
    },
  })

  return NextResponse.json({
    resetPeriod: chatbot?.creditResetPeriod ?? 'none',
    initialCredits: chatbot?.creditInitialCredits ?? 0,
    resetAmount: chatbot?.creditResetAmount ?? 0,
    maxCredits: chatbot?.creditMaxCredits ?? 0,
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

No additional migration is required for credit configuration; the scalar credit fields already exist on `Chatbot`, and the credit tracking fields are present on `ChatUsageCredits`.

#### 6.2 Existing User Credits

Options for users with 0 credits:

1. **Immediate Boost**: Set current credits to initial amount
2. **Next Reset**: Wait for next reset period
3. **Hybrid**: Partial credits now, full reset on schedule

### Phase 7: Configuration Examples

#### 7.1 Common Credit Policies

- Conservative daily allowance: `creditInitialCredits=5`, `creditResetPeriod=daily`, `creditResetAmount=5`, `creditMaxCredits=5`
- Weekly batch with accumulation: `creditInitialCredits=20`, `creditResetPeriod=weekly`, `creditResetAmount=15`, `creditMaxCredits=30`
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
