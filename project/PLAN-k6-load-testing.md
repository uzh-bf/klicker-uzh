# k6 Load Testing Plan for Response API Infrastructure

## Overview

This plan outlines comprehensive load testing strategy for the KlickerUZH response processing infrastructure, focusing on:

1. **Comparative Performance Analysis**: TypeScript vs Go response-api implementations
2. **Mode-Specific Testing**: Assessment mode (immediate) vs Normal mode (batched)
3. **Infrastructure Validation**: Hatchet queue capacity and worker processing throughput
4. **End-to-End Performance**: Complete response pipeline from ingestion to processing

## Test Objectives

### Primary Goals

- **Performance Baseline**: Establish performance characteristics of current TypeScript implementation
- **Migration Validation**: Verify Go implementation meets or exceeds TypeScript performance
- **Capacity Planning**: Determine maximum sustainable throughput for each implementation
- **Mode Validation**: Ensure assessment mode reliability and normal mode efficiency
- **Infrastructure Scaling**: Test Hatchet queue and worker scaling capabilities

### Success Criteria

| Implementation | Metric         | Assessment Mode | Normal Mode  |
| -------------- | -------------- | --------------- | ------------ |
| TypeScript     | Throughput     | 500 RPS         | 1,000 RPS    |
| TypeScript     | P95 Latency    | 200ms           | 100ms        |
| TypeScript     | Error Rate     | <0.1%           | <1%          |
| Go             | Throughput     | 2,000 RPS       | 10,000 RPS   |
| Go             | P95 Latency    | 100ms           | 50ms         |
| Go             | Error Rate     | <0.1%           | <1%          |
| Infrastructure | Queue Depth    | <100 events     | <1000 events |
| Infrastructure | Processing Lag | <5 seconds      | <30 seconds  |

## Test Scenarios

### 1. Smoke Tests

**Purpose**: Basic functionality validation and script verification

```javascript
// Config
export let options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
}
```

**Use Cases**:

- New deployment validation
- Script correctness verification
- Basic endpoint availability check

### 2. Load Tests

**Purpose**: Normal expected traffic simulation

```javascript
// Config
export let options = {
  stages: [
    { duration: '5m', target: 100 }, // Ramp up
    { duration: '20m', target: 1000 }, // Stay at load
    { duration: '5m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],
    http_req_failed: ['rate<1'],
  },
}
```

**Scenarios**:

- Peak lecture hours (500-1000 concurrent students)
- Mixed assessment/normal mode traffic (20%/80%)
- Realistic response payload distribution

### 3. Stress Tests

**Purpose**: Determine breaking point and behavior under extreme load

```javascript
// Config
export let options = {
  stages: [
    { duration: '2m', target: 1000 }, // Ramp to normal
    { duration: '5m', target: 5000 }, // Stress level
    { duration: '5m', target: 10000 }, // Peak stress
    { duration: '3m', target: 0 }, // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<5'],
  },
}
```

**Focus Areas**:

- Resource exhaustion points
- Error rates under pressure
- Recovery behavior
- Queue overflow handling

### 4. Spike Tests

**Purpose**: Sudden traffic surge simulation

```javascript
// Config
export let options = {
  stages: [
    { duration: '10s', target: 100 }, // Normal load
    { duration: '30s', target: 10000 }, // Instant spike
    { duration: '1m', target: 10000 }, // Sustain spike
    { duration: '10s', target: 100 }, // Drop back
    { duration: '2m', target: 100 }, // Recover
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<10'],
  },
}
```

**Scenarios**:

- Large lecture quiz start (500+ students joining simultaneously)
- Assessment submission deadline rush
- System recovery after spike

### 5. Soak Tests

**Purpose**: Long-duration stability and memory leak detection

```javascript
// Config
export let options = {
  stages: [
    { duration: '10m', target: 1000 }, // Ramp up
    { duration: '4h', target: 1000 }, // Maintain load
    { duration: '10m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'],
    http_req_failed: ['rate<1'],
  },
}
```

**Monitoring**:

- Memory usage patterns
- Connection pool behavior
- Garbage collection impact
- Resource leaks

## Test Infrastructure

### Local Development Environment

```yaml
# docker-compose.k6.yml
version: '3.8'
services:
  k6:
    image: grafana/k6:latest
    ports:
      - '6565:6565'
    environment:
      - K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write
    volumes:
      - ./tests:/scripts
    command: run /scripts/load-test.js
    networks:
      - klicker-network

  prometheus:
    image: prom/prometheus:latest
    ports:
      - '9090:9090'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    networks:
      - klicker-network

  grafana:
    image: grafana/grafana:latest
    ports:
      - '3000:3000'
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - ./grafana-dashboards:/var/lib/grafana/dashboards
    networks:
      - klicker-network

networks:
  klicker-network:
    external: true
```

**Usage**:

```bash
# Start monitoring stack
docker-compose -f docker-compose.k6.yml up -d

# Run specific test
docker run --rm -i grafana/k6:latest run - <tests/smoke-test.js

# Run with custom configuration
k6 run --vus=100 --duration=30s tests/load-test.js
```

### Staging Kubernetes Environment

```yaml
# k6-operator-setup.yml
apiVersion: v1
kind: Namespace
metadata:
  name: k6-testing
---
apiVersion: k6.io/v1alpha1
kind: TestRun
metadata:
  name: response-api-load-test
  namespace: k6-testing
spec:
  parallelism: 4
  script:
    configMap:
      name: load-test-script
      file: load-test.js
  arguments: --vus=1000 --duration=30m
  runner:
    image: grafana/k6:latest
    resources:
      requests:
        cpu: 500m
        memory: 512Mi
      limits:
        cpu: 1000m
        memory: 1Gi
  separate: true # Use separate pods for better resource isolation
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: load-test-script
  namespace: k6-testing
data:
  load-test.js: |
    import http from 'k6/http';
    import { check, sleep } from 'k6';
    import { Rate } from 'k6/metrics';

    const errorRate = new Rate('errors');

    export let options = {
      stages: [
        { duration: '5m', target: 250 },   // Per instance
        { duration: '20m', target: 250 },  // Total: 1000 VUs
        { duration: '5m', target: 0 },
      ],
      thresholds: {
        http_req_duration: ['p(95)<200'],
        errors: ['rate<0.01'],
      },
    };

    const BASE_URL = __ENV.TARGET_URL || 'http://response-api:7078';

    export default function() {
      const payload = generateResponsePayload();
      const response = http.post(`${BASE_URL}/AddResponse`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      
      const success = check(response, {
        'status is 200': (r) => r.status === 200,
        'response time OK': (r) => r.timings.duration < 1000,
      });
      
      errorRate.add(!success);
      sleep(1);
    }

    function generateResponsePayload() {
      return JSON.stringify({
        response: { choices: [{ ix: 0, selected: true }] },
        sessionId: Math.random() > 0.2 ? `normal_${Math.random()}` : `assessment_${Math.random()}`,
        instanceId: `instance_${Math.random()}`,
      });
    }
```

**Deployment Commands**:

```bash
# Install k6 operator
kubectl apply -f https://github.com/grafana/k6-operator/releases/latest/download/bundle.yaml

# Deploy test configuration
kubectl apply -f k6-operator-setup.yml

# Monitor test execution
kubectl logs -f -l app=k6 -n k6-testing

# Get test results
kubectl describe testrun response-api-load-test -n k6-testing
```

### Production Environment

```yaml
# production-synthetic-tests.yml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: synthetic-load-test
  namespace: monitoring
spec:
  schedule: '0 */4 * * *' # Every 4 hours
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: k6
              image: grafana/k6:latest
              args:
                - run
                - --vus=10
                - --duration=5m
                - --quiet
                - /scripts/synthetic-test.js
              volumeMounts:
                - name: test-scripts
                  mountPath: /scripts
              env:
                - name: TARGET_URL
                  value: 'https://api.klicker.uzh.ch'
          volumes:
            - name: test-scripts
              configMap:
                name: synthetic-test-scripts
          restartPolicy: OnFailure
```

## Test Scripts

### Base Test Structure

```javascript
// tests/utils/base-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// Custom metrics
export const errorRate = new Rate('errors')
export const responseTime = new Trend('response_time')

export class ResponseAPITester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl
    this.sessionCounter = 0
  }

  generatePayload(mode = 'auto') {
    const sessionId =
      mode === 'assessment' || (mode === 'auto' && Math.random() < 0.2)
        ? `assessment_${this.sessionCounter++}`
        : `normal_${this.sessionCounter++}`

    return {
      response: this.generateResponse(),
      sessionId: sessionId,
      instanceId: `instance_${Math.random().toString(36).substr(2, 9)}`,
    }
  }

  generateResponse() {
    const types = ['SC', 'MC', 'NUMERICAL', 'FREE_TEXT']
    const type = types[Math.floor(Math.random() * types.length)]

    switch (type) {
      case 'SC':
      case 'MC':
        return {
          choices: Array.from({ length: 4 }, (_, ix) => ({
            ix,
            selected: Math.random() < 0.3,
          })),
        }
      case 'NUMERICAL':
        return { value: Math.floor(Math.random() * 100) }
      case 'FREE_TEXT':
        return { value: `Answer ${Math.random().toString(36).substr(2, 9)}` }
      default:
        return { choices: [{ ix: 0, selected: true }] }
    }
  }

  sendResponse(payload, headers = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    }

    const response = http.post(
      `${this.baseUrl}/AddResponse`,
      JSON.stringify(payload),
      { headers: defaultHeaders }
    )

    const success = check(response, {
      'status is 200': (r) => r.status === 200,
      'response time < 1s': (r) => r.timings.duration < 1000,
      'has valid response': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.status && body.timestamp
        } catch (e) {
          return false
        }
      },
    })

    errorRate.add(!success)
    responseTime.add(response.timings.duration)

    return { response, success }
  }

  authenticatedRequest(payload) {
    const cookie = 'participant_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...'
    return this.sendResponse(payload, { Cookie: cookie })
  }
}
```

### Specific Test Implementations

```javascript
// tests/comparison-test.js
import { ResponseAPITester } from './utils/base-test.js'

export let options = {
  scenarios: {
    typescript_api: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 0 },
      ],
      env: { API_TYPE: 'typescript' },
      tags: { implementation: 'typescript' },
    },
    go_api: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 500 },
        { duration: '2m', target: 0 },
      ],
      env: { API_TYPE: 'go' },
      tags: { implementation: 'go' },
    },
  },
  thresholds: {
    'http_req_duration{implementation:typescript}': ['p(95)<300'],
    'http_req_duration{implementation:go}': ['p(95)<150'],
    'errors{implementation:typescript}': ['rate<0.01'],
    'errors{implementation:go}': ['rate<0.005'],
  },
}

const configs = {
  typescript: 'http://response-api-ts:7078',
  go: 'http://response-api-go:7078',
}

export default function () {
  const apiType = __ENV.API_TYPE
  const tester = new ResponseAPITester(configs[apiType])

  const payload = tester.generatePayload()
  const { response, success } = tester.sendResponse(payload)

  // Tag responses for analysis
  response.tags = { ...response.tags, implementation: apiType }

  sleep(1)
}
```

```javascript
// tests/mode-specific-test.js
import { ResponseAPITester } from './utils/base-test.js'

export let options = {
  scenarios: {
    assessment_mode: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
      env: { MODE: 'assessment' },
      tags: { mode: 'assessment' },
    },
    normal_mode: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 200 },
        { duration: '6m', target: 800 },
        { duration: '2m', target: 0 },
      ],
      env: { MODE: 'normal' },
      tags: { mode: 'normal' },
    },
  },
  thresholds: {
    'http_req_duration{mode:assessment}': ['p(95)<100'],
    'http_req_duration{mode:normal}': ['p(95)<50'],
    'errors{mode:assessment}': ['rate<0.001'],
    'errors{mode:normal}': ['rate<0.01'],
  },
}

const BASE_URL = __ENV.TARGET_URL || 'http://response-api:7078'

export default function () {
  const mode = __ENV.MODE
  const tester = new ResponseAPITester(BASE_URL)

  const payload = tester.generatePayload(mode)

  const headers = mode === 'assessment' ? { 'X-Assessment-Mode': 'true' } : {}

  const { response, success } = tester.sendResponse(payload, headers)
  response.tags = { ...response.tags, mode }

  sleep(mode === 'assessment' ? 2 : 0.5)
}
```

```javascript
// tests/hatchet-capacity-test.js
import { ResponseAPITester } from './utils/base-test.js'
import { Counter } from 'k6/metrics'

const batchedEvents = new Counter('batched_events')
const immediateEvents = new Counter('immediate_events')

export let options = {
  scenarios: {
    capacity_test: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { duration: '2m', target: 500 }, // 500 RPS
        { duration: '5m', target: 2000 }, // 2000 RPS
        { duration: '5m', target: 5000 }, // 5000 RPS
        { duration: '3m', target: 100 }, // Cool down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.05'],
    batched_events: ['count>0'],
    immediate_events: ['count>0'],
  },
}

const BASE_URL = __ENV.TARGET_URL || 'http://response-api-go:7078'

export default function () {
  const tester = new ResponseAPITester(BASE_URL)

  // 80% normal mode (batched), 20% assessment mode (immediate)
  const mode = Math.random() < 0.8 ? 'normal' : 'assessment'
  const payload = tester.generatePayload(mode)

  const headers = mode === 'assessment' ? { 'X-Assessment-Mode': 'true' } : {}

  const { response, success } = tester.sendResponse(payload, headers)

  if (success) {
    if (mode === 'assessment') {
      immediateEvents.add(1)
    } else {
      batchedEvents.add(1)
    }
  }
}
```

## Monitoring and Metrics

### k6 Prometheus Integration

```yaml
# prometheus-config.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'k6'
    static_configs:
      - targets: ['localhost:6565']
    scrape_interval: 5s
    metrics_path: /metrics

  - job_name: 'response-api-ts'
    static_configs:
      - targets: ['response-api-ts:7078']
    metrics_path: /metrics

  - job_name: 'response-api-go'
    static_configs:
      - targets: ['response-api-go:7078']
    metrics_path: /metrics

  - job_name: 'hatchet'
    static_configs:
      - targets: ['hatchet:8080']
    metrics_path: /api/v1/metrics

remote_write:
  - url: 'http://grafana-cloud-prometheus/api/prom/push'
    basic_auth:
      username: 'your-username'
      password: 'your-api-key'
```

### Grafana Dashboards

```json
{
  "dashboard": {
    "title": "Response API Load Testing",
    "panels": [
      {
        "title": "Request Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(http_reqs_total[1m])) by (implementation)",
            "legendFormat": "{{implementation}} RPS"
          }
        ]
      },
      {
        "title": "Response Time Distribution",
        "type": "heatmap",
        "targets": [
          {
            "expr": "increase(http_req_duration_bucket[1m])",
            "legendFormat": "{{le}}"
          }
        ]
      },
      {
        "title": "Error Rate by Implementation",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(errors_total[1m]) * 100",
            "legendFormat": "{{implementation}} Error %"
          }
        ]
      },
      {
        "title": "Hatchet Queue Depth",
        "type": "graph",
        "targets": [
          {
            "expr": "hatchet_queue_depth",
            "legendFormat": "Queue Depth"
          }
        ]
      }
    ]
  }
}
```

### Alerting Rules

```yaml
# alerting-rules.yml
groups:
  - name: load_testing_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(errors_total[1m]) > 0.01
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: 'High error rate detected'
          description: 'Error rate is {{ $value }}% for {{ $labels.implementation }}'

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_req_duration_bucket[5m])) > 500
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: 'High response time detected'
          description: 'P95 response time is {{ $value }}ms'

      - alert: HatchetQueueBacklog
        expr: hatchet_queue_depth > 1000
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: 'Hatchet queue backlog detected'
          description: 'Queue depth is {{ $value }} events'
```

## Test Execution Strategies

### Development Workflow

```bash
#!/bin/bash
# scripts/run-dev-tests.sh

set -e

echo "🚀 Starting development load tests..."

# Start local infrastructure
docker-compose up -d response-api-ts response-api-go hatchet redis prometheus grafana

# Wait for services to be ready
./scripts/wait-for-services.sh

# Run smoke tests first
echo "🔍 Running smoke tests..."
k6 run --quiet tests/smoke-test.js

# Run comparative tests
echo "⚖️ Running TypeScript vs Go comparison..."
k6 run --quiet tests/comparison-test.js

# Run mode-specific tests
echo "🎯 Running mode-specific tests..."
k6 run --quiet tests/mode-specific-test.js

# Generate report
echo "📊 Generating test report..."
./scripts/generate-report.sh

echo "✅ All tests completed successfully!"
```

### Staging Environment

```bash
#!/bin/bash
# scripts/run-staging-tests.sh

set -e

NAMESPACE="k6-testing"
KUBECONFIG=${KUBECONFIG:-~/.kube/config}

echo "🎪 Running staging load tests..."

# Create namespace
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Deploy test configurations
kubectl apply -f k8s/staging/ -n $NAMESPACE

# Run test suite
TEST_RUNS=(
  "smoke-test"
  "load-test"
  "stress-test"
  "spike-test"
)

for test in "${TEST_RUNS[@]}"; do
  echo "🏃 Running $test..."

  kubectl apply -f k8s/tests/$test.yml -n $NAMESPACE

  # Wait for completion
  kubectl wait --for=condition=complete job/$test -n $NAMESPACE --timeout=1h

  # Collect results
  kubectl logs job/$test -n $NAMESPACE > results/$test-$(date +%Y%m%d-%H%M%S).log
done

echo "🎉 Staging tests completed!"
```

### Production Monitoring

```bash
#!/bin/bash
# scripts/synthetic-monitoring.sh

set -e

echo "🔍 Running production synthetic tests..."

# Light load only - safety first
k6 run \
  --vus=5 \
  --duration=2m \
  --quiet \
  --env TARGET_URL=https://api.klicker.uzh.ch \
  tests/synthetic-test.js

# Check if any critical thresholds were breached
if [ $? -ne 0 ]; then
  echo "⚠️ Production synthetic test failed!"
  # Trigger alert webhook
  curl -X POST https://alerts.klicker.uzh.ch/webhook \
    -H "Content-Type: application/json" \
    -d '{"alert": "synthetic_test_failed", "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'"}'
  exit 1
fi

echo "✅ Production synthetic test passed"
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/load-testing.yml
name: Load Testing Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  smoke-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start Test Environment
        run: |
          docker-compose -f docker-compose.test.yml up -d
          ./scripts/wait-for-services.sh

      - name: Run Smoke Tests
        uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/smoke-test.js

      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: smoke-test-results
          path: results/

  performance-comparison:
    runs-on: ubuntu-latest
    needs: smoke-tests
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v3

      - name: Performance Regression Test
        uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/comparison-test.js
        env:
          K6_PROMETHEUS_RW_SERVER_URL: ${{ secrets.PROMETHEUS_URL }}

      - name: Compare with Baseline
        run: ./scripts/compare-performance.sh

      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const results = require('./results/comparison.json');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Performance Test Results\n\n${results.summary}`
            });

  staging-load-test:
    runs-on: ubuntu-latest
    needs: smoke-tests
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Configure kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.21.0'

      - name: Deploy to Staging
        run: kubectl apply -f k8s/staging/

      - name: Run Load Tests
        run: ./scripts/run-staging-tests.sh

      - name: Publish Results
        run: ./scripts/publish-results.sh
```

## Test Data Management

### Response Payload Templates

```javascript
// tests/data/payloads.js
export const payloadTemplates = {
  singleChoice: {
    response: {
      choices: [
        { ix: 0, selected: true },
        { ix: 1, selected: false },
        { ix: 2, selected: false },
        { ix: 3, selected: false },
      ],
    },
  },

  multipleChoice: {
    response: {
      choices: [
        { ix: 0, selected: true },
        { ix: 1, selected: false },
        { ix: 2, selected: true },
        { ix: 3, selected: false },
      ],
    },
  },

  numerical: {
    response: {
      value: 42,
    },
  },

  freeText: {
    response: {
      value: 'This is a sample free text response',
    },
  },

  selection: {
    response: {
      selection: [0, 2, 1, -1], // -1 indicates skipped
    },
  },

  caseStudy: {
    response: {
      assessment: {
        case1: {
          item1: {
            criterion1: 4,
            criterion2: 3,
          },
        },
      },
    },
  },
}

export function generateRandomPayload() {
  const types = Object.keys(payloadTemplates)
  const randomType = types[Math.floor(Math.random() * types.length)]
  return payloadTemplates[randomType]
}
```

### Session Data Generator

```javascript
// tests/data/sessions.js
export class SessionGenerator {
  constructor() {
    this.sessionCounter = 0
    this.instanceCounter = 0
  }

  generateSession(type = 'normal') {
    const sessionId =
      type === 'assessment'
        ? `assessment_${this.sessionCounter++}`
        : `normal_${this.sessionCounter++}`

    return {
      sessionId,
      instanceId: `instance_${this.instanceCounter++}`,
      type,
      createdAt: Date.now(),
    }
  }

  generateBatch(size = 100, assessmentRatio = 0.2) {
    const sessions = []
    for (let i = 0; i < size; i++) {
      const type = Math.random() < assessmentRatio ? 'assessment' : 'normal'
      sessions.push(this.generateSession(type))
    }
    return sessions
  }
}
```

## Results Analysis

### Performance Report Generator

```javascript
// scripts/generate-report.js
import { readFileSync } from 'fs'

export function generatePerformanceReport(testResults) {
  const report = {
    summary: {
      totalRequests: testResults.metrics.http_reqs.count,
      averageResponseTime: testResults.metrics.http_req_duration.avg,
      p95ResponseTime: testResults.metrics.http_req_duration['p(95)'],
      errorRate: testResults.metrics.http_req_failed.rate * 100,
      throughput: testResults.metrics.http_reqs.rate,
    },

    thresholds: {
      passed: testResults.metrics.checks.passes,
      failed: testResults.metrics.checks.fails,
      total: testResults.metrics.checks.value,
    },

    recommendations: generateRecommendations(testResults),
  }

  return report
}

function generateRecommendations(results) {
  const recommendations = []

  if (results.metrics.http_req_duration['p(95)'] > 200) {
    recommendations.push(
      'Consider optimizing response time - P95 exceeds 200ms'
    )
  }

  if (results.metrics.http_req_failed.rate > 0.01) {
    recommendations.push('Error rate is above 1% - investigate error causes')
  }

  if (results.metrics.http_reqs.rate < 1000) {
    recommendations.push(
      'Throughput below target - consider scaling infrastructure'
    )
  }

  return recommendations
}
```

### Comparison Analysis

```bash
#!/bin/bash
# scripts/compare-performance.sh

set -e

BASELINE_FILE="results/baseline-performance.json"
CURRENT_FILE="results/current-performance.json"
COMPARISON_FILE="results/comparison.json"

if [ ! -f "$BASELINE_FILE" ]; then
  echo "⚠️ No baseline found, setting current results as baseline"
  cp "$CURRENT_FILE" "$BASELINE_FILE"
  exit 0
fi

echo "📊 Comparing performance against baseline..."

node -e "
const baseline = require('./$BASELINE_FILE');
const current = require('./$CURRENT_FILE');

const comparison = {
  responseTime: {
    baseline: baseline.summary.p95ResponseTime,
    current: current.summary.p95ResponseTime,
    change: ((current.summary.p95ResponseTime - baseline.summary.p95ResponseTime) / baseline.summary.p95ResponseTime * 100).toFixed(2)
  },
  throughput: {
    baseline: baseline.summary.throughput,
    current: current.summary.throughput,
    change: ((current.summary.throughput - baseline.summary.throughput) / baseline.summary.throughput * 100).toFixed(2)
  },
  errorRate: {
    baseline: baseline.summary.errorRate,
    current: current.summary.errorRate,
    change: ((current.summary.errorRate - baseline.summary.errorRate) / baseline.summary.errorRate * 100).toFixed(2)
  }
};

comparison.summary = \`
## Performance Comparison

| Metric | Baseline | Current | Change |
|--------|----------|---------|--------|
| P95 Response Time | \${comparison.responseTime.baseline}ms | \${comparison.responseTime.current}ms | \${comparison.responseTime.change}% |
| Throughput | \${comparison.throughput.baseline} RPS | \${comparison.throughput.current} RPS | \${comparison.throughput.change}% |
| Error Rate | \${comparison.errorRate.baseline}% | \${comparison.errorRate.current}% | \${comparison.errorRate.change}% |
\`;

require('fs').writeFileSync('$COMPARISON_FILE', JSON.stringify(comparison, null, 2));
console.log(comparison.summary);
"

# Check for regressions
node -e "
const comparison = require('./$COMPARISON_FILE');
let hasRegression = false;

if (parseFloat(comparison.responseTime.change) > 10) {
  console.log('❌ Response time regression detected: +' + comparison.responseTime.change + '%');
  hasRegression = true;
}

if (parseFloat(comparison.throughput.change) < -10) {
  console.log('❌ Throughput regression detected: ' + comparison.throughput.change + '%');
  hasRegression = true;
}

if (parseFloat(comparison.errorRate.change) > 50) {
  console.log('❌ Error rate regression detected: +' + comparison.errorRate.change + '%');
  hasRegression = true;
}

if (hasRegression) {
  console.log('❌ Performance regression detected - review required');
  process.exit(1);
} else {
  console.log('✅ No significant performance regression detected');
}
"
```

## Implementation Checklist

### Phase 1: Setup & Infrastructure

- [ ] Install k6 locally and verify functionality
- [ ] Set up Docker Compose environment for local testing
- [ ] Configure Prometheus and Grafana for metrics collection
- [ ] Create base test utilities and payload generators
- [ ] Implement basic smoke test for current TypeScript API

### Phase 2: Core Test Development

- [ ] Develop comprehensive test scenarios (load, stress, spike, soak)
- [ ] Create comparison tests for TypeScript vs Go implementations
- [ ] Implement mode-specific tests (assessment vs normal)
- [ ] Add Hatchet capacity and throughput tests
- [ ] Configure thresholds and success criteria

### Phase 3: Kubernetes Integration

- [ ] Install k6 operator in staging environment
- [ ] Create Kubernetes test configurations and deployments
- [ ] Set up distributed test execution with proper resource allocation
- [ ] Configure monitoring and alerting for test runs
- [ ] Implement result collection and analysis

### Phase 4: CI/CD Integration

- [ ] Add GitHub Actions workflow for automated testing
- [ ] Configure performance regression detection
- [ ] Set up baseline performance tracking
- [ ] Implement automatic result reporting and notifications
- [ ] Create production synthetic monitoring

### Phase 5: Production Readiness

- [ ] Establish production testing safety limits
- [ ] Configure production monitoring and alerting
- [ ] Create runbooks for performance issue investigation
- [ ] Set up capacity planning based on test results
- [ ] Document test procedures and maintenance tasks

This comprehensive plan provides a structured approach to load testing the response API infrastructure, enabling confident migration from TypeScript to Go while ensuring system reliability and performance standards.
