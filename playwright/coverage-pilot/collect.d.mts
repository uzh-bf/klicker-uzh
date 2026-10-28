import type { Page } from '@playwright/test'

type Metric = {
  total: number
  covered: number
  skipped: number
  pct: number | 'Unknown'
}

export function collectCoverage(options: {
  entries: Awaited<ReturnType<Page['coverage']['stopJSCoverage']>>
  root: string
  origin: string
  journey: string
  browserVersion: string
}): Promise<{
  total: Record<
    'lines' | 'statements' | 'functions' | 'branches' | 'branchesTrue',
    Metric
  >
  files: Array<{ path: string; sourceSha256: string }>
}>
