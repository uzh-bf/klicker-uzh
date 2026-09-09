import type { Page, Route } from '@playwright/test'
import { isGraphqlOperation } from '../../util/graphqlRequest.js'
import { enMessages as messages } from '../../util/messages.js'
import { expect, importExportTest } from './fixture.js'
import { getManageOrigin } from './support.js'

const uploadContainer = 'playwright-media'
const uploadHref = 'https://media.example.test/playwright-media.png'
const uploadMediaFileId = 'playwright-media-file-id'
const directMediaUploadMaxBytes = 256 * 1024 * 1024
const uploadFile = {
  name: 'playwright-media.png',
  mimeType: 'image/png',
  buffer: Buffer.from('playwright media upload'),
}
const insertedMarkdown = `![${uploadFile.name}](${uploadHref})`

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })

  return { promise, resolve }
}

async function fulfillGraphql(route: Route, data: Record<string, unknown>) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data }),
  })
}

async function fulfillEmptyMediaLibrary(route: Route) {
  await fulfillGraphql(route, { userMediaFiles: [] })
}

function getMediaUploadSas() {
  const uploadSasURL = new URL('/playwright-media-upload', getManageOrigin())
  uploadSasURL.searchParams.set('sig', 'playwright')

  return {
    mediaFileId: uploadMediaFileId,
    uploadSasURL: uploadSasURL.toString(),
    uploadHref,
    containerName: uploadContainer,
    fileName: uploadFile.name,
  }
}

async function fulfillBlobUpload(route: Route) {
  const request = route.request()
  expect(request.method()).toBe('PUT')
  expect(new URL(request.url()).pathname).toBe(
    `/playwright-media-upload/${uploadContainer}/${uploadFile.name}`
  )

  await route.fulfill({
    status: 201,
    headers: {
      etag: '"playwright-etag"',
      'last-modified': new Date(0).toUTCString(),
      'x-ms-request-id': 'playwright-request-id',
      'x-ms-version': '2023-11-03',
    },
  })
}

async function openMediaUpload(page: Page) {
  await page.getByTestId('create-question').click()

  const editor = page.getByTestId('insert-question-text')
  await expect(editor).toBeVisible()
  const imageButtonIcon = editor
    .locator('xpath=../..')
    .locator('.toolbar svg[data-icon="image"]')
  await expect(imageButtonIcon).toHaveCount(1)
  await imageButtonIcon.click()

  const uploadTitle = page.getByText(
    messages.manage.elements.uploadImageHeader,
    { exact: true }
  )
  await expect(uploadTitle).toBeVisible()

  const dropzone = uploadTitle.locator('..')
  return {
    dropzone,
    editor,
    fileInput: dropzone.locator('input[type="file"]'),
  }
}

export function registerMediaUploadImportExportCases() {
  importExportTest(
    'Media uploads explain unsupported file types before requesting a SAS target',
    async ({ page }) => {
      let sasRequestCount = 0

      await page.route('**/api/graphql*', async (route) => {
        const request = route.request()

        if (isGraphqlOperation(request, 'GetUserMediaFiles')) {
          await fulfillEmptyMediaLibrary(route)
          return
        }

        if (isGraphqlOperation(request, 'GetFileUploadSas')) {
          sasRequestCount += 1
        }

        await route.continue()
      })

      const { dropzone, editor, fileInput } = await openMediaUpload(page)
      await fileInput.setInputFiles({
        name: 'not-an-image.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('not an image'),
      })

      await expect(
        page.getByText(messages.manage.elements.uploadImageInvalidFileType, {
          exact: true,
        })
      ).toBeVisible()
      await expect(dropzone).toHaveAttribute('aria-busy', 'false')
      await expect(editor).not.toContainText('not-an-image.txt')
      expect(sasRequestCount).toBe(0)
    }
  )

  importExportTest(
    'Media uploads reject oversized files before requesting a SAS target',
    async ({ page }) => {
      let sasRequestCount = 0
      let blobUploadCount = 0
      let finalizationCount = 0

      await page.route('**/api/graphql*', async (route) => {
        const request = route.request()

        if (isGraphqlOperation(request, 'GetUserMediaFiles')) {
          await fulfillEmptyMediaLibrary(route)
          return
        }

        if (isGraphqlOperation(request, 'GetFileUploadSas')) {
          sasRequestCount += 1
          await fulfillGraphql(route, {
            getFileUploadSas: getMediaUploadSas(),
          })
          return
        }

        if (isGraphqlOperation(request, 'FinalizeFileUpload')) {
          finalizationCount += 1
          await fulfillGraphql(route, { finalizeFileUpload: true })
          return
        }

        await route.continue()
      })
      await page.route('**/playwright-media-upload**', async (route) => {
        blobUploadCount += 1
        await fulfillBlobUpload(route)
      })

      const { dropzone, editor, fileInput } = await openMediaUpload(page)
      await fileInput.evaluate(
        (input, { fileName, mimeType, oversizedBytes }) => {
          const fileInput = input as HTMLInputElement
          const oversizedFile = new File(['oversized'], fileName, {
            type: mimeType,
          })
          Object.defineProperty(oversizedFile, 'size', {
            value: oversizedBytes,
          })

          const transfer = new DataTransfer()
          transfer.items.add(oversizedFile)
          fileInput.files = transfer.files
          fileInput.dispatchEvent(new Event('change', { bubbles: true }))
        },
        {
          fileName: uploadFile.name,
          mimeType: uploadFile.mimeType,
          oversizedBytes: directMediaUploadMaxBytes + 1,
        }
      )

      await expect(
        page.getByText(
          messages.manage.elements.uploadImageTooLarge.replace(
            '{maxSizeMiB}',
            String(directMediaUploadMaxBytes / 1024 / 1024)
          ),
          { exact: true }
        )
      ).toBeVisible()
      await expect(dropzone).toHaveAttribute('aria-busy', 'false')
      await expect(editor).not.toContainText(insertedMarkdown)

      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
      )
      expect(sasRequestCount).toBe(0)
      expect(blobUploadCount).toBe(0)
      expect(finalizationCount).toBe(0)
    }
  )

  importExportTest(
    'Media uploads finalize before insertion and tolerate a failed library refetch',
    async ({ page }) => {
      const finalizationRequested = deferred()
      const releaseFinalization = deferred()
      const refetchRequested = deferred()
      const releaseRefetchFailure = deferred()
      const refetchFailureDelivered = deferred()
      const uploadEvents: string[] = []
      let mediaLibraryRequestCount = 0

      await page.route('**/api/graphql*', async (route) => {
        const request = route.request()

        if (isGraphqlOperation(request, 'GetUserMediaFiles')) {
          mediaLibraryRequestCount += 1
          if (mediaLibraryRequestCount === 1) {
            await fulfillEmptyMediaLibrary(route)
            return
          }

          refetchRequested.resolve()
          await releaseRefetchFailure.promise
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: null,
              errors: [{ message: 'Simulated media library refetch failure' }],
            }),
          })
          refetchFailureDelivered.resolve()
          return
        }

        if (isGraphqlOperation(request, 'GetFileUploadSas')) {
          uploadEvents.push('sas')
          await fulfillGraphql(route, {
            getFileUploadSas: getMediaUploadSas(),
          })
          return
        }

        if (isGraphqlOperation(request, 'FinalizeFileUpload')) {
          const payload = request.postDataJSON() as {
            variables?: { mediaFileId?: unknown }
          }
          expect(payload.variables?.mediaFileId).toBe(uploadMediaFileId)
          uploadEvents.push('finalize')
          finalizationRequested.resolve()
          await releaseFinalization.promise
          await fulfillGraphql(route, { finalizeFileUpload: true })
          return
        }

        await route.continue()
      })
      await page.route('**/playwright-media-upload**', async (route) => {
        uploadEvents.push('blob')
        await fulfillBlobUpload(route)
      })

      const { editor, fileInput } = await openMediaUpload(page)
      await fileInput.setInputFiles(uploadFile)
      await finalizationRequested.promise

      expect(uploadEvents[0]).toBe('sas')
      expect(uploadEvents).toContain('blob')
      expect(uploadEvents.at(-1)).toBe('finalize')
      expect(uploadEvents.indexOf('sas')).toBeLessThan(
        uploadEvents.indexOf('blob')
      )
      expect(uploadEvents.lastIndexOf('blob')).toBeLessThan(
        uploadEvents.indexOf('finalize')
      )
      await expect(editor).not.toContainText(insertedMarkdown)

      releaseFinalization.resolve()
      await expect(editor).toContainText(insertedMarkdown)
      await refetchRequested.promise
      releaseRefetchFailure.resolve()
      await refetchFailureDelivered.promise

      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          })
      )
      await expect(editor).toContainText(insertedMarkdown)
      await expect(
        page.getByText(messages.manage.elements.uploadImageFailed, {
          exact: true,
        })
      ).not.toBeAttached()
      expect(mediaLibraryRequestCount).toBe(2)
      expect(uploadEvents.filter((event) => event === 'sas')).toHaveLength(1)
      expect(uploadEvents.filter((event) => event === 'finalize')).toHaveLength(
        1
      )
    }
  )

  importExportTest(
    'Media uploads reject a missing SAS target without uploading or finalizing',
    async ({ page }) => {
      let blobUploadCount = 0
      let finalizationCount = 0

      await page.route('**/api/graphql*', async (route) => {
        const request = route.request()

        if (isGraphqlOperation(request, 'GetUserMediaFiles')) {
          await fulfillEmptyMediaLibrary(route)
          return
        }

        if (isGraphqlOperation(request, 'GetFileUploadSas')) {
          await fulfillGraphql(route, { getFileUploadSas: null })
          return
        }

        if (isGraphqlOperation(request, 'FinalizeFileUpload')) {
          finalizationCount += 1
          await fulfillGraphql(route, { finalizeFileUpload: true })
          return
        }

        await route.continue()
      })
      await page.route('**/playwright-media-upload**', async (route) => {
        blobUploadCount += 1
        await fulfillBlobUpload(route)
      })

      const { dropzone, editor, fileInput } = await openMediaUpload(page)
      await fileInput.setInputFiles(uploadFile)

      await expect(
        page.getByText(messages.manage.elements.uploadImageFailed, {
          exact: true,
        })
      ).toBeVisible()
      await expect(dropzone).toHaveAttribute('aria-busy', 'false')
      await expect(editor).not.toContainText(insertedMarkdown)
      expect(blobUploadCount).toBe(0)
      expect(finalizationCount).toBe(0)
    }
  )

  importExportTest(
    'Media uploads retry transient finalization with the same media file ID',
    async ({ page }) => {
      let blobUploadCount = 0
      let finalizationCount = 0
      let mediaLibraryRequestCount = 0
      const finalizedMediaFileIds: unknown[] = []

      await page.route('**/api/graphql*', async (route) => {
        const request = route.request()

        if (isGraphqlOperation(request, 'GetUserMediaFiles')) {
          mediaLibraryRequestCount += 1
          await fulfillEmptyMediaLibrary(route)
          return
        }

        if (isGraphqlOperation(request, 'GetFileUploadSas')) {
          await fulfillGraphql(route, {
            getFileUploadSas: getMediaUploadSas(),
          })
          return
        }

        if (isGraphqlOperation(request, 'FinalizeFileUpload')) {
          finalizationCount += 1
          const payload = request.postDataJSON() as {
            variables?: { mediaFileId?: unknown }
          }
          finalizedMediaFileIds.push(payload.variables?.mediaFileId)
          await fulfillGraphql(route, {
            finalizeFileUpload: finalizationCount > 1,
          })
          return
        }

        await route.continue()
      })
      await page.route('**/playwright-media-upload**', async (route) => {
        blobUploadCount += 1
        await fulfillBlobUpload(route)
      })

      const { editor, fileInput } = await openMediaUpload(page)
      await fileInput.setInputFiles(uploadFile)

      await expect(editor).toContainText(insertedMarkdown)
      await expect(
        page.getByText(messages.manage.elements.uploadImageFailed, {
          exact: true,
        })
      ).not.toBeAttached()
      expect(
        (await editor.textContent())?.split(insertedMarkdown)
      ).toHaveLength(2)
      expect(blobUploadCount).toBeGreaterThan(0)
      expect(finalizationCount).toBe(2)
      expect(finalizedMediaFileIds).toEqual([
        uploadMediaFileId,
        uploadMediaFileId,
      ])
      await expect.poll(() => mediaLibraryRequestCount).toBe(2)
    }
  )

  importExportTest(
    'Media uploads stop retrying failed finalization without inserting the image',
    async ({ page }) => {
      let blobUploadCount = 0
      let finalizationCount = 0
      let mediaLibraryRequestCount = 0
      const finalizedMediaFileIds: unknown[] = []

      await page.route('**/api/graphql*', async (route) => {
        const request = route.request()

        if (isGraphqlOperation(request, 'GetUserMediaFiles')) {
          mediaLibraryRequestCount += 1
          await fulfillEmptyMediaLibrary(route)
          return
        }

        if (isGraphqlOperation(request, 'GetFileUploadSas')) {
          await fulfillGraphql(route, {
            getFileUploadSas: getMediaUploadSas(),
          })
          return
        }

        if (isGraphqlOperation(request, 'FinalizeFileUpload')) {
          finalizationCount += 1
          const payload = request.postDataJSON() as {
            variables?: { mediaFileId?: unknown }
          }
          finalizedMediaFileIds.push(payload.variables?.mediaFileId)
          await fulfillGraphql(route, { finalizeFileUpload: false })
          return
        }

        await route.continue()
      })
      await page.route('**/playwright-media-upload**', async (route) => {
        blobUploadCount += 1
        await fulfillBlobUpload(route)
      })

      const { dropzone, editor, fileInput } = await openMediaUpload(page)
      await fileInput.setInputFiles(uploadFile)

      await expect(
        page.getByText(messages.manage.elements.uploadImageFailed, {
          exact: true,
        })
      ).toBeVisible()
      await expect(dropzone).toHaveAttribute('aria-busy', 'false')
      await expect(editor).not.toContainText(insertedMarkdown)
      expect(blobUploadCount).toBeGreaterThan(0)
      expect(finalizationCount).toBe(3)
      expect(finalizedMediaFileIds).toEqual([
        uploadMediaFileId,
        uploadMediaFileId,
        uploadMediaFileId,
      ])
      expect(mediaLibraryRequestCount).toBe(1)
    }
  )
}
