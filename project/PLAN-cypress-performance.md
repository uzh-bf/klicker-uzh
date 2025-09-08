# Cypress Performance Optimization Plan

> **Project:** KlickerUZH  
> **Date:** January 2025  
> **Current Status:** Tests run for very long time with many test cases  
> **Goal:** Optimize both local development and CI execution performance

## Executive Summary

After analyzing the current Cypress setup and researching latest performance best practices, we've identified several critical bottlenecks and optimization opportunities. The current test suite runs sequentially with heavy database operations, no session caching, and suboptimal configuration. Implementing the proposed optimizations could reduce total execution time by 50-70% and improve test reliability significantly.

## Current State Analysis

### Test Suite Composition
- **26 test files** in `cypress/cypress/e2e/`
- **Alphabetically ordered** execution (0-baseline-ops.cy.ts → Z-*)
- **Large test files** (e.g., O-live-quiz-workflow.cy.ts: 173,977 characters)
- **Complex UI interactions** with real events and database operations
- **CI timeout:** 120 minutes (extremely long)

### Current Configuration Issues
```typescript
// cypress.config.ts - Current Issues Identified
export default defineConfig({
  video: true,                           // ❌ Always recording video
  experimentalMemoryManagement: true,    // ✅ Good, but needs optimization
  trashAssetsBeforeRuns: true,          // ❌ Adds I/O overhead
  // Missing parallelization config
  // Missing session management config
  // Missing selective video recording
})
```

### CI/CD Pipeline Issues
```yaml
# .github/workflows/cypress-testing.yml - Current Issues
strategy:
  # fail-fast: false # ❌ Commented out
  # matrix:
  #   containers: [1, 2] # ❌ Parallelization disabled
```

### Performance Bottlenecks Identified

1. **Database Operations (Critical)**
   - Full database seeding in `cypress.config.ts` for every test run
   - Extensive Prisma operations in `setupNodeEvents`
   - No test isolation for database state
   - Heavy participant/course seeding (49+ participant IDs, 14+ group IDs)

2. **Authentication (High Impact)**
   - No `cy.session()` usage - login repeated for every test
   - JWT token generation in every `loginFactory` call
   - Cookie clearing and resetting for each authentication

3. **Test Execution (High Impact)**
   - Sequential execution only (no parallelization)
   - No test splitting or intelligent load balancing
   - All tests treated with equal priority

4. **Resource Management (Medium Impact)**
   - Video recording for all tests
   - No selective execution based on code changes
   - Memory management not optimized beyond basic flag

## Performance Optimization Strategy

### Phase 1: Immediate Wins (Week 1)

#### 1.1 Enable Test Parallelization
**Impact:** 50-70% reduction in total execution time

**Implementation:**
```yaml
# .github/workflows/cypress-testing.yml
strategy:
  fail-fast: false
  matrix:
    containers: [1, 2, 3, 4, 5]  # 5 parallel containers

jobs:
  cypress-run:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        containers: [1, 2, 3, 4, 5]
    
    steps:
      # ... existing steps ...
      
      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          record: true
          parallel: true
          group: 'E2E Tests'
        env:
          CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 1.2 Implement cy.session() for Authentication
**Impact:** 30-40% reduction in individual test time

**Implementation:**
```typescript
// cypress/cypress/support/commands.ts - Enhanced
Cypress.Commands.add('loginLecturer', () => {
  cy.session('lecturer-session', () => {
    // Existing login logic here
    cy.clearAllCookies()
    cy.clearAllLocalStorage()
    cy.clearAllSessionStorage()
    
    const secret = new TextEncoder().encode(Cypress.env('APP_SECRET'))
    const alg = 'HS256'
    
    cy.wrap(null).then(async () => {
      const token = await new jose.SignJWT({
        email: 'lecturer@df.uzh.ch',
        sub: '76047345-3801-4628-ae7b-adbebcfe8821',
        role: 'ADMIN',
        scope: 'ACCOUNT_OWNER',
        catalystInstitutional: true,
        catalystIndividual: true,
      })
        .setProtectedHeader({ alg })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(secret)

      cy.setCookie('next-auth.session-token', token, {
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      })
    })
  }, {
    validate() {
      // Validate session is still active
      cy.getCookie('next-auth.session-token').should('exist')
      cy.request({
        url: Cypress.env('URL_MANAGE') + '/api/auth/session',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200)
      })
    },
    cacheAcrossSpecs: true
  })
  
  cy.visit(Cypress.env('URL_MANAGE'))
})
```

#### 1.3 Optimize Video Recording
**Impact:** Reduced I/O overhead and faster cleanup

**Implementation:**
```typescript
// cypress.config.ts - Updated configuration
export default defineConfig({
  video: false,  // Disable by default
  videoOnFailureOnly: true,  // Only record on failures
  screenshotOnRunFailure: true,
  videosFolder: 'cypress/videos',
  screenshotsFolder: 'cypress/screenshots',
  
  env: {
    // Add environment flag for video control
    RECORD_VIDEO: process.env.CYPRESS_RECORD_VIDEO || 'false',
  },
  
  e2e: {
    setupNodeEvents(on, config) {
      // Conditionally enable video based on environment
      if (config.env.RECORD_VIDEO === 'true') {
        config.video = true
      }
      
      // ... rest of setup
    }
  }
})
```

### Phase 2: Structural Optimizations (Week 2)

#### 2.1 Database Seeding Strategy Optimization
**Impact:** Faster test initialization and improved isolation

**Current Problem:**
```typescript
// cypress.config.ts - Heavy seeding in config (BEFORE)
on('task', {
  async seedDatabase() {
    // 300+ lines of database seeding
    // Creates 7 users, 3 courses, 49 participants, etc.
    // Runs for EVERY test execution
  }
})
```

**Optimized Solution:**
```typescript
// cypress/cypress/support/commands.ts - Smart seeding (AFTER)
Cypress.Commands.add('seedMinimal', () => {
  cy.task('seedMinimalData').then((result: boolean) => {
    if (!result) {
      throw new Error('Minimal seeding failed!')
    }
  })
})

Cypress.Commands.add('seedForLiveQuiz', () => {
  cy.task('seedLiveQuizData').then((result: boolean) => {
    if (!result) {
      throw new Error('Live quiz seeding failed!')
    }
  })
})

// cypress.config.ts - Granular seeding tasks
on('task', {
  async seedMinimalData() {
    // Only essential: 1 user, 1 course, basic structure
    // ~50 lines instead of 300+
  },
  
  async seedLiveQuizData() {
    // Specific to live quiz tests
    // On-demand seeding
  },
  
  async seedGroupActivityData() {
    // Specific to group activity tests
    // On-demand seeding
  }
})
```

#### 2.2 Replace Static Waits with Dynamic Waits
**Impact:** More reliable and faster test execution

**Current Problem:**
```typescript
// Multiple static waits found in codebase
cy.wait(300)  // Brief wait for animation
cy.wait(500)  // Wait for modal
cy.wait(100)  // Wait for dropdown
```

**Optimized Solution:**
```typescript
// cypress/cypress/support/commands.ts - Dynamic waits
Cypress.Commands.add('waitForModal', () => {
  cy.get('[data-cy*="modal"]').should('be.visible')
  cy.get('[data-cy*="modal"]').should('not.have.class', 'animate-enter')
})

Cypress.Commands.add('waitForDropdown', (selector: string) => {
  cy.get(selector).should('be.visible')
  cy.get(selector).find('[role="option"]').should('have.length.greaterThan', 0)
})

// Usage in tests (replace cy.wait(300) with:)
cy.waitForModal()
cy.waitForDropdown('[data-cy="select-course"]')
```

#### 2.3 Split Large Test Files
**Impact:** Better parallelization and maintainability

**Current Problem:**
- `O-live-quiz-workflow.cy.ts`: 173,977 characters
- Single large test files that can't be split across containers efficiently

**Optimized Solution:**
```
cypress/cypress/e2e/
├── live-quiz/
│   ├── O1-live-quiz-creation.cy.ts
│   ├── O2-live-quiz-execution.cy.ts  
│   ├── O3-live-quiz-results.cy.ts
│   └── O4-live-quiz-analytics.cy.ts
├── practice-quiz/
│   ├── Q1-practice-quiz-creation.cy.ts
│   ├── Q2-practice-quiz-student-flow.cy.ts
│   └── Q3-practice-quiz-scoring.cy.ts
├── microlearning/
│   ├── P1-microlearning-setup.cy.ts
│   └── P2-microlearning-execution.cy.ts
```

### Phase 3: Advanced Optimizations (Week 3)

#### 3.1 Memory Management Optimization
**Impact:** Reduced memory usage and OOM prevention

```typescript
// cypress.config.ts - Memory optimization
export default defineConfig({
  experimentalMemoryManagement: true,
  numTestsKeptInMemory: 0,  // Aggressive memory cleanup
  defaultCommandTimeout: 10000,
  pageLoadTimeout: 30000,
  requestTimeout: 10000,
  responseTimeout: 30000,
  
  e2e: {
    setupNodeEvents(on, config) {
      // Enable memory debugging if needed
      if (process.env.CYPRESS_MEMORY_DEBUG) {
        process.env.CYPRESS_INTERNAL_MEMORY_SAVE_STATS = '1'
      }
      
      // ... rest of config
    }
  }
})
```

#### 3.2 Test Categorization and Selective Execution
**Impact:** Faster feedback loops and resource efficiency

```typescript
// cypress/cypress/support/commands.ts - Test tagging
Cypress.Commands.add('skipOnSmoke', () => {
  if (Cypress.env('TEST_TYPE') === 'smoke') {
    cy.log('Skipping test in smoke mode')
    return cy.skip()
  }
})

// Usage in test files:
describe('Comprehensive Live Quiz Flow', () => {
  beforeEach(() => {
    cy.skipOnSmoke()  // Skip heavy tests in smoke runs
  })
  
  it('should handle complex multi-user scenarios', () => {
    // Heavy integration test
  })
})
```

#### 3.3 Smart Test Orchestration
**Impact:** Optimized resource utilization

```yaml
# .github/workflows/cypress-smoke.yml - Fast feedback
name: Cypress Smoke Tests
on:
  pull_request:
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'cypress/**'

jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - # ... setup steps
      - name: Run smoke tests
        uses: cypress-io/github-action@v6
        with:
          spec: 'cypress/e2e/**/*smoke*.cy.ts'
        env:
          TEST_TYPE: 'smoke'
```

```yaml
# .github/workflows/cypress-full.yml - Complete coverage
name: Cypress Full Test Suite
on:
  push:
    branches: ['v3']
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM

jobs:
  full-tests:
    # ... full parallel matrix setup
```

## Implementation Roadmap

### Week 1: Critical Performance Wins
- [ ] **Day 1-2:** Implement GitHub Actions matrix parallelization
- [ ] **Day 3-4:** Add cy.session() to all authentication commands
- [ ] **Day 5:** Configure conditional video recording
- [ ] **Expected Result:** 60%+ reduction in CI execution time

### Week 2: Structural Improvements  
- [ ] **Day 1-2:** Create granular database seeding tasks
- [ ] **Day 3-4:** Replace static waits with dynamic assertions
- [ ] **Day 5:** Split large test files into focused suites
- [ ] **Expected Result:** 30%+ improvement in test reliability

### Week 3: Advanced Optimizations
- [ ] **Day 1-2:** Optimize memory management configuration
- [ ] **Day 3-4:** Implement test categorization and selective execution
- [ ] **Day 5:** Add performance monitoring and metrics
- [ ] **Expected Result:** Further 20% improvement + better maintainability

## Success Metrics

### Before Optimization (Current State)
- **Total CI time:** ~120 minutes
- **Single test avg:** ~4-5 minutes  
- **Memory usage:** High (OOM risks)
- **Reliability:** Variable (static waits, no session caching)
- **Parallel execution:** None

### After Optimization (Target State)
- **Total CI time:** ~30-40 minutes (70% reduction)
- **Single test avg:** ~2-3 minutes (40% reduction)
- **Memory usage:** Optimized with numTestsKeptInMemory: 0
- **Reliability:** High (dynamic waits, session caching)
- **Parallel execution:** 5 containers + intelligent load balancing

## Monitoring and Maintenance

### Performance Dashboard Setup
```typescript
// cypress/cypress/support/commands.ts - Performance tracking
Cypress.Commands.add('measureTestTime', (testName: string) => {
  const startTime = Date.now()
  
  // Add to after hook
  Cypress.on('test:after:run', (test) => {
    const duration = Date.now() - startTime
    cy.task('logPerformance', {
      testName,
      duration,
      timestamp: new Date().toISOString()
    })
  })
})
```

### Continuous Optimization
1. **Weekly performance reviews** using Cypress Dashboard analytics
2. **Monthly test suite health checks** for memory usage and reliability
3. **Quarterly optimization sprints** for emerging performance patterns
4. **Test splitting strategies** based on execution time data

## Risk Assessment

### Low Risk
- **Parallel execution:** Well-established pattern, high success rate
- **cy.session() implementation:** Official Cypress feature, widely used
- **Video recording optimization:** Simple configuration change

### Medium Risk  
- **Database seeding restructure:** Requires careful test isolation planning
- **Large file splitting:** May require test logic adjustments

### High Risk
- **Memory configuration changes:** Could impact test stability if misconfigured

### Mitigation Strategies
1. **Gradual rollout:** Implement optimizations incrementally
2. **A/B testing:** Run old and new configurations in parallel initially  
3. **Rollback plan:** Keep current configuration as fallback
4. **Monitoring:** Extensive performance and reliability monitoring during transition

## Conclusion

This comprehensive optimization plan addresses the core performance bottlenecks in the KlickerUZH Cypress test suite. By implementing parallelization, session caching, smart seeding, and configuration optimizations, we expect to achieve:

- **70% reduction in total CI execution time**
- **40% reduction in individual test execution time** 
- **Significant improvement in test reliability**
- **Better resource utilization and developer experience**

The phased approach ensures minimal disruption while delivering immediate performance wins in Week 1, followed by structural improvements that will provide long-term benefits for test maintainability and scalability.

## Addendum – Pragmatic Updates (Sep 2025)

Why: Prioritize low-risk, high-impact steps based on the current repo state to cut CI time and improve stability without large refactors.

### Immediate Actions (Week 1)

- CI parallelization: Enable matrix and parallel runs in `.github/workflows/cypress-testing.yml` (4–5 containers, `fail-fast: false`) and use Cypress Dashboard load balancing.
- Session caching: Wrap all `login*` commands with `cy.session(..., { cacheAcrossSpecs: true })` plus a lightweight validator (check session cookie + `/api/auth/session === 200`).
- Reduce I/O + memory: In `cypress.config.ts` set `video: false`, `trashAssetsBeforeRuns: false`, keep `experimentalMemoryManagement: true`, set `numTestsKeptInMemory: 0`. Note: Cypress doesn’t support “videoOnFailureOnly”; enable video via env when needed. Keep `screenshotOnRunFailure: true`.
- Gate code coverage: Only import `@cypress/code-coverage/support` when `ENABLE_COVERAGE === 'true'` to avoid overhead in normal runs.

### Structural (Week 2)

- Stop full DB wipe per spec: Remove most `cy.cleanup()` calls in `after()`; keep targeted cleanup only where isolation is truly required. Prefer unique names + selective deletes over full resets.
- Replace static waits: Introduce helpers (`waitForModal`, `waitForDropdown`, `waitForToastToDisappear`) and replace the most expensive `cy.wait(n)` occurrences.
- Split oversized specs: Break up `O-live-quiz-*.cy.ts`, `P-microlearning-*.cy.ts`, `Q-practice-quiz-*.cy.ts`, `S-group-activity-*.cy.ts` into focused files for better parallel distribution.
- Batch backend creates: Replace repetitive `cy.task(...); cy.reload()` sequences with a `createElementsBatch` task and one reload per phase.

### Advanced (Week 3)

- DB baseline snapshot (optional): Seed once per job; optionally `pg_dump -Fc` a baseline and `pg_restore --clean` for suites that need hard isolation. Alternatively, run isolation-heavy tests in a separate job.
- Smoke vs. full workflows: Add a fast smoke workflow for PRs and keep the full suite on `v3` and nightly.

### Expected Impact

- 50–70% CI time reduction via parallelization, session caching, and avoiding per-spec reseed/cleanup.
- Improved stability by replacing static waits and reducing retries after stabilization.

### Risks & Mitigations

- Cross-spec interference: Use unique names; keep targeted cleanup where necessary.
- `cy.session` flakiness: Minimal validator; `cacheAcrossSpecs: true`.
- Parallel flakes: `fail-fast: false`, Dashboard balancing, retries tuned down once stable.

### Notes & Clarifications

- Cypress does not support `videoOnFailureOnly`. Disable videos by default (`video: false`) and enable via env when needed; keep `screenshotOnRunFailure: true`.
- Prefer one-time seed per job over per-spec seeds; introduce granular seeding and DB snapshot only where needed.
