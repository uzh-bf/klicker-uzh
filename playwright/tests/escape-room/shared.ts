import { expect, type Browser, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import deMessages from '../../../packages/i18n/messages/de.js'
import { enMessages as messages } from '../../util/messages.js'

export const evidenceDir = process.env.ESCAPE_ROOM_EVIDENCE_DIR

export async function captureEvidence(page: Page, filename: string) {
  if (!evidenceDir) return
  await mkdir(evidenceDir, { recursive: true })
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({
    path: join(evidenceDir, filename),
    fullPage: true,
    animations: 'disabled',
  })
}

export async function setLocale(page: Page, locale: 'en' | 'de') {
  const url = new URL(page.url())
  url.pathname = url.pathname.replace(/^\/(?:en|de)(?=\/|$)/, '') || '/'
  if (locale !== 'en') {
    url.pathname = `/${locale}${url.pathname}`
  }
  await page.goto(url.toString(), { waitUntil: 'commit' })
  await expect(page.locator('html')).toHaveAttribute('lang', locale)
}

export async function createStudentPage(browser: Browser) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  })
  return context.newPage()
}

export function timerSeconds(value: string) {
  const [minutes, seconds] = value.split(':').map(Number)
  return minutes! * 60 + seconds!
}

export const COURSE = 'Testkurs'

export const QUIZ = {
  name: 'Escape Room Quiz',
  displayName: 'Escape Room Quiz Display',
  description: 'Escape room e2e test quiz',
  introText: 'The vault is sealed. Solve every stage to escape before',
  timeLimitMinutes: '30',
  hintPenaltySeconds: '30',
  hint: 'The answer is the first option.',
}
export const MICRO = {
  name: 'Escape Room Microlearning',
  displayName: 'Escape Room Microlearning Display',
}

export const SC1 = {
  title: 'ER SC Question 1',
  content: 'ER SC Content 1',
  choices: [{ value: '25%', correct: true }, { value: '50%' }],
}
export const SC2 = {
  title: 'ER SC Question 2',
  content: 'ER SC Content 2',
  choices: [{ value: '100%', correct: true }, { value: '0%' }],
}
export const CT1 = {
  title: 'ER Content 1',
  content: 'ER Content Element 1',
}
export const QR = {
  title: 'ER QR Scan Question',
  content: 'Scan the hidden vault marker',
  code: 'AbCdEf12_-34',
  quizName: 'Escape Room QR Quiz',
  quizDisplayName: 'Escape Room QR Quiz Display',
}
export const GROUP = {
  name: 'Escape Room Group Activity',
  displayName: 'Escape Room Group Activity Display',
  task: 'Crack the vault together before the timer runs out.',
  introText: 'Only teamwork opens the vault. Coordinate and escape.',
  clues: [
    { name: 'Vault Clue Alpha', displayName: 'Clue Alpha', content: 'north' },
    { name: 'Vault Clue Beta', displayName: 'Clue Beta', content: 'south' },
  ],
}
export const LIVE = {
  name: 'Escape Room Live Quiz',
  displayName: 'Escape Room Live Quiz Display',
  description: 'Escape room live quiz e2e test',
  // authored in MINUTES; the backend stores the escape time limit in seconds,
  // so the edit round-trip below is the regression guard for that conversion
  timeLimitMinutes: '5',
  hintPenaltySeconds: '45',
  introText: 'The live vault is sealed. Escape before the timer runs out.',
}

export { deMessages, expect, messages }
