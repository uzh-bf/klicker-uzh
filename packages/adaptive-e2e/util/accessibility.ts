import { expect, type Page } from '@playwright/test'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const axeSource = (require('axe-core') as { source: string }).source

type AxeViolation = {
  id: string
  impact: string | null
  help: string
  nodes: Array<{ html: string; target: unknown }>
}

export async function assertNoSeriousAccessibilityViolations(page: Page) {
  await page.addScriptTag({ content: axeSource })
  const violations = await page.evaluate(async () => {
    const axe = (
      globalThis as typeof globalThis & {
        axe: {
          run: (
            context: Document,
            options: Record<string, unknown>
          ) => Promise<{ violations: AxeViolation[] }>
        }
      }
    ).axe
    const result = await axe.run(document, {
      resultTypes: ['violations'],
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    })
    return result.violations.filter(
      ({ impact }) => impact === 'serious' || impact === 'critical'
    )
  })

  expect(
    violations,
    `Serious or critical accessibility violations:\n${JSON.stringify(
      violations,
      null,
      2
    )}`
  ).toEqual([])
}

export async function assertReflowsAtTwoHundredPercent(page: Page) {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Accessibility reflow requires a viewport.')

  await page.setViewportSize({
    width: Math.max(320, Math.floor(viewport.width / 2)),
    height: viewport.height,
  })
  try {
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth
        )
      )
      .toBeLessThanOrEqual(1)
  } finally {
    await page.setViewportSize(viewport)
  }
}
