import { getPrisma } from '../global-setup.js'
import {
  CHATBOT_ID,
  ensureChatbotSeeded,
  ensureSecondChatbotSeeded,
  removeSecondChatbotSeed,
  SECOND_CHATBOT_ID,
} from '../util/chat.js'
import {
  COURSE_ID_TEST,
  COURSE_ID_TEST2,
  COURSE_ID_TEST3,
  PARTICIPANT_IDS,
  URL_STUDENT,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

const studentUrl = process.env.URL_STUDENT ?? URL_STUDENT
const courseUrl = `${studentUrl}/en/course/${COURSE_ID_TEST}`

test.describe('Course chatbot drawer', () => {
  test.beforeEach(async ({ loginStudent }) => {
    await ensureChatbotSeeded()
    await ensureSecondChatbotSeeded()
    await loginStudent()
  })

  test.afterAll(async () => {
    await removeSecondChatbotSeed()
  })

  test('exposes modal relationships and contains keyboard focus', async ({
    page,
  }) => {
    await expect(page.getByTestId('homepage')).toBeVisible()
    await page.goto(courseUrl)

    const launcher = page.getByTestId('course-chatbot-open')
    await expect(launcher).toBeVisible()
    await expect(launcher).toHaveAttribute(
      'aria-controls',
      'course-chatbot-dialog'
    )
    await expect(launcher).toHaveAttribute('aria-expanded', 'false')
    await expect(launcher).toHaveAttribute('aria-haspopup', 'dialog')

    await launcher.click()

    const dialog = page.getByRole('dialog', { name: 'Course Chat' })
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await expect(dialog).toHaveAttribute('id', 'course-chatbot-dialog')

    await expect
      .poll(() =>
        page.evaluate(() => {
          const root = document.getElementById('__next')
          return {
            ariaHidden: root?.getAttribute('aria-hidden'),
            inert: root?.inert,
          }
        })
      )
      .toEqual({ ariaHidden: 'true', inert: true })

    await expect
      .poll(() =>
        page.evaluate(() => {
          const panel = document.getElementById('course-chatbot-dialog')
          return panel?.contains(document.activeElement) ?? false
        })
      )
      .toBe(true)

    const firstControl = page.getByTestId('course-chatbot-selector')
    const lastControl = page.getByTestId('course-chatbot-frame')

    await firstControl.focus()
    await page.keyboard.press('Shift+Tab')
    await expect(lastControl).toBeFocused()

    await lastControl.focus()
    await page.keyboard.press('Tab')
    await expect
      .poll(() =>
        page.evaluate(() => {
          const panel = document.getElementById('course-chatbot-dialog')
          return panel?.contains(document.activeElement) ?? false
        })
      )
      .toBe(true)

    // A real iframe can consume Tab inside its own document before returning
    // focus to the parent. Exercise the parent trap branch directly as well,
    // so removal of the explicit last-to-first wrap cannot pass unnoticed.
    await lastControl.focus()
    await page.evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' })
      )
    })
    await expect(firstControl).toBeFocused()
  })

  test('switches chatbots and keeps the drawer actions accessible', async ({
    page,
  }) => {
    await expect(page.getByTestId('homepage')).toBeVisible()
    await page.goto(courseUrl)
    await page.getByTestId('course-chatbot-open').click()

    const selector = page.getByTestId('course-chatbot-selector')
    const frame = page.getByTestId('course-chatbot-frame')
    const newTab = page.getByTestId('course-chatbot-new-tab')

    await expect(selector).toBeVisible()
    await expect(selector.locator('option')).toHaveCount(2)
    await expect(frame).toHaveAttribute('title', 'Course chatbot')
    await expect(frame).toHaveAttribute('src', new RegExp(CHATBOT_ID))

    await selector.selectOption(SECOND_CHATBOT_ID)
    await expect(frame).toHaveAttribute('src', new RegExp(SECOND_CHATBOT_ID))
    await expect(newTab).toHaveAttribute('href', new RegExp(SECOND_CHATBOT_ID))
    await expect(newTab).toHaveAttribute('target', '_blank')

    await newTab.focus()
    await expect(newTab).toBeFocused()
    const popupPromise = page.waitForEvent('popup')
    await page.keyboard.press('Enter')
    const popup = await popupPromise
    await expect(popup).toHaveURL(new RegExp(SECOND_CHATBOT_ID))
    await popup.close()
  })

  test('Escape and Close restore the page and launcher focus', async ({
    page,
  }) => {
    await expect(page.getByTestId('homepage')).toBeVisible()
    await page.goto(courseUrl)

    const launcher = page.getByTestId('course-chatbot-open')
    await launcher.click()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(launcher).toBeFocused()
    await expect
      .poll(() =>
        page.evaluate(() => {
          const root = document.getElementById('__next')
          return {
            ariaHidden: root?.getAttribute('aria-hidden'),
            inert: root?.inert,
          }
        })
      )
      .toEqual({ ariaHidden: null, inert: false })

    await launcher.click()
    await page.getByTestId('course-chatbot-close').click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(launcher).toBeFocused()

    await launcher.click()
    await page.evaluate(async (url) => {
      const nextRouter = (
        window as typeof window & {
          next?: { router?: { push: (href: string) => Promise<boolean> } }
        }
      ).next?.router

      if (!nextRouter) throw new Error('Next.js router is unavailable')
      await nextRouter.push(url)
    }, `${courseUrl}?embed=true`)

    await expect(page).toHaveURL(`${courseUrl}?embed=true`)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const root = document.getElementById('__next')
          return {
            ariaHidden: root?.getAttribute('aria-hidden'),
            inert: root?.inert,
          }
        })
      )
      .toEqual({ ariaHidden: null, inert: false })
  })

  test('keeps the close action visible in an embedded mobile viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('homepage')).toBeVisible()
    await page.goto(`${courseUrl}?embed=true`)
    await page.getByTestId('course-chatbot-open').click()

    const close = page.getByTestId('course-chatbot-close')
    await expect(close).toBeVisible()
    const box = await close.boundingBox()

    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    expect(box!.y + box!.height).toBeLessThanOrEqual(844)
  })
})

test.describe('Course chatbot entry fallbacks', () => {
  test('missing participation keeps the localized course link', async ({
    loginStudent,
    page,
  }) => {
    await loginStudent()
    await expect(page.getByTestId('homepage')).toBeVisible()
    await page.goto(`${studentUrl}/en/course/${COURSE_ID_TEST2}/chatbot`)

    const courseLink = page.getByTestId('course-chatbot-course-link')
    await expect(courseLink).toBeVisible()
    await expect(courseLink).toHaveAttribute(
      'href',
      `/en/course/${COURSE_ID_TEST2}`
    )
    await expect(courseLink).toHaveText('Open course')
  })

  test('a participating course without a chatbot keeps the localized course link', async ({
    loginStudent,
    page,
  }) => {
    const prisma = await getPrisma()
    await prisma.participation.upsert({
      where: {
        courseId_participantId: {
          courseId: COURSE_ID_TEST3,
          participantId: PARTICIPANT_IDS[0],
        },
      },
      create: {
        courseId: COURSE_ID_TEST3,
        participantId: PARTICIPANT_IDS[0],
      },
      update: {},
    })

    try {
      await loginStudent()
      await expect(page.getByTestId('homepage')).toBeVisible()
      await page.goto(`${studentUrl}/en/course/${COURSE_ID_TEST3}/chatbot`)

      const courseLink = page.getByTestId('course-chatbot-course-link')
      await expect(courseLink).toBeVisible()
      await expect(courseLink).toHaveAttribute(
        'href',
        `/en/course/${COURSE_ID_TEST3}`
      )
      await expect(courseLink).toHaveText('Open course')
    } finally {
      await prisma.participation.deleteMany({
        where: {
          courseId: COURSE_ID_TEST3,
          participantId: PARTICIPANT_IDS[0],
        },
      })
    }
  })
})
