# Cypress Parallel Testing Optimization Plan

## Current State Analysis

### Problems with Current Setup
- **8x Build Redundancy**: Each parallel container rebuilds the entire application
- **8x Dependency Installation**: Each container runs `pnpm install` independently
- **Inefficient Caching**: Limited cache sharing between matrix jobs
- **Resource Waste**: ~60-70% of execution time spent on duplicate build operations
- **Cost Impact**: Unnecessary compute usage across all 8 containers

### Performance Bottlenecks Identified
1. **Build Step**: `pnpm run --filter @klicker-uzh/prisma build:test && pnpm run build:test`
2. **Dependency Installation**: `pnpm install` in each container
3. **Cache Misses**: Poor cache hit rates for node_modules and build artifacts
4. **Service Startup**: Database/Redis initialization per container

## Proposed Solution: Build Once, Test Many

### Architecture Overview
```
┌─────────────────┐    ┌──────────────────┐
│  Build Job      │───▶│  Artifacts Store │
│  (Single Run)   │    │  - node_modules  │
└─────────────────┘    │  - Build outputs │
                       │  - .turbo cache  │
                       └──────────────────┘
                                │
                        ┌───────┼───────┐
                        ▼       ▼       ▼
                   ┌─────────────────────────┐
                   │  Test Jobs (Matrix 8x)  │
                   │  - Download artifacts   │
                   │  - Run Cypress tests    │
                   │  - Upload results       │
                   └─────────────────────────┘
```

### Benefits
- **60-70% Time Reduction**: Build once instead of 8 times
- **Resource Optimization**: Efficient use of GitHub Actions minutes
- **Cost Savings**: Reduced compute usage
- **Reliability**: Consistent build artifacts across all test runs

## Implementation Plan

### Phase 1: Split Workflow into Two Jobs

#### Job 1: `build-and-cache`
```yaml
build-and-cache:
  if: |
    (github.event_name == 'pull_request' && github.event.pull_request.draft == true) ||
    (github.event_name == 'push' && github.ref != 'refs/heads/v3')
  runs-on: ubuntu-24.04
  steps:
    - name: Checkout code
    - name: Setup Node.js and pnpm with caching
    - name: Install dependencies
    - name: Build all packages and apps
    - name: Upload build artifacts
    - name: Cache node_modules and build outputs
```

#### Job 2: `cypress-run-parallel-draft`
```yaml
cypress-run-parallel-draft:
  needs: build-and-cache
  runs-on: ubuntu-24.04
  strategy:
    matrix:
      containers: [1, 2, 3, 4, 5, 6, 7, 8]
  services:
    # Keep existing services (postgres, redis, hatchet)
  steps:
    - name: Checkout code
    - name: Download build artifacts
    - name: Setup services and wait for readiness
    - name: Run Cypress tests with cypress-split
```

### Phase 2: Optimize Caching Strategy

#### A. Dependency Caching
```yaml
# Use setup-node's built-in pnpm cache
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: 'pnpm'
    cache-dependency-path: '**/pnpm-lock.yaml'

# Additional node_modules cache
- uses: actions/cache@v4
  with:
    path: |
      node_modules
      **/node_modules
    key: ${{ runner.os }}-deps-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: |
      ${{ runner.os }}-deps-
```

#### B. Build Output Caching
```yaml
- uses: actions/cache@v4
  with:
    path: |
      .turbo
      **/.next/cache
      **/dist
      apps/*/dist
      apps/*/.next
    key: ${{ runner.os }}-build-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-build-${{ github.ref_name }}-
      ${{ runner.os }}-build-
```

#### C. Cypress Binary Caching
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/Cypress
    key: ${{ runner.os }}-cypress-${{ hashFiles('**/package.json') }}
    restore-keys: |
      ${{ runner.os }}-cypress-
```

### Phase 3: Artifact Management

#### Upload Strategy (Build Job)
```yaml
- name: Upload build artifacts
  uses: actions/upload-artifact@v4
  with:
    name: build-artifacts
    path: |
      node_modules
      .turbo
      apps/*/dist
      apps/*/.next
      packages/*/dist
    retention-days: 1
    compression-level: 6
```

#### Download Strategy (Test Jobs)
```yaml
- name: Download build artifacts
  uses: actions/download-artifact@v4
  with:
    name: build-artifacts
    path: .
```

## Implementation Steps

### Step 1: Update Workflow Structure
1. Create `build-and-cache` job with all build logic
2. Update `cypress-run-parallel-draft` to depend on build job
3. Remove build steps from test job
4. Add artifact upload/download

### Step 2: Optimize Caching
1. Upgrade to `actions/cache@v4` and `actions/setup-node@v4`
2. Implement multi-layer caching strategy
3. Add proper cache keys based on file hashes
4. Configure cache restore fallbacks

### Step 3: Test and Validate
1. Run workflow and measure performance improvement
2. Validate all tests pass with shared artifacts
3. Monitor cache hit rates
4. Fine-tune artifact paths if needed

### Step 4: Apply to Both Jobs
1. Apply same optimization to `cypress-run-cloud` job
2. Ensure consistency between draft and production workflows
3. Update documentation

## Expected Performance Impact

### Before Optimization
```
Build Job: N/A
Test Jobs: 8 containers × (5min build + 10min test) = 120min total
Cost: High (redundant builds)
```

### After Optimization
```
Build Job: 1 container × 5min build = 5min
Test Jobs: 8 containers × 10min test = 80min parallel (10min actual)
Total: ~15min vs 120min = 87% improvement
Cost: Significantly reduced
```

### Cache Hit Scenarios
- **Cold cache**: ~15min total time
- **Warm cache**: ~8min total time (dependencies cached)
- **Hot cache**: ~5min total time (build outputs cached)

## Risk Mitigation

### Potential Issues
1. **Artifact Size**: Large artifacts may slow download
2. **Cache Eviction**: GitHub's 10GB cache limit
3. **Dependency Drift**: Inconsistent dependencies between jobs

### Mitigation Strategies
1. **Selective Artifacts**: Only upload necessary files
2. **Cache Hierarchy**: Use multiple cache layers with fallbacks
3. **Dependency Locking**: Ensure pnpm-lock.yaml consistency
4. **Monitoring**: Track cache hit rates and performance metrics

## Success Metrics

- **Time Reduction**: Target 60-70% improvement in total workflow time
- **Cache Hit Rate**: Target >80% cache hits for dependencies
- **Cost Reduction**: Measure GitHub Actions minutes saved
- **Reliability**: Zero test failures due to artifact issues

## Next Steps

1. **Implementation Phase**: Update workflow files
2. **Testing Phase**: Validate performance improvements
3. **Monitoring Phase**: Track metrics and optimize further
4. **Documentation**: Update team workflows and best practices

## References

- [GitHub Actions Caching Documentation](https://docs.github.com/en/actions/guides/caching-dependencies-to-speed-up-workflows)
- [PNPM CI Best Practices](https://pnpm.io/continuous-integration)
- [Turborepo GitHub Actions Guide](https://turborepo.com/docs/guides/ci-vendors/github-actions)