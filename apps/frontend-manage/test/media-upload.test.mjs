import assert from 'node:assert/strict'
import { test } from 'node:test'
import { uploadMediaFile } from '../src/lib/mediaUpload.ts'

const file = new File(['synthetic image'], 'image.png', { type: 'image/png' })
const upload = {
  uploadUrl: 'https://storage.example.test/key?synthetic-signature',
  uploadHref: 'https://media.example.test/key',
  uploadHeaders: [{ name: 'Content-Type', value: 'image/png' }],
}

test('uploads with exact signed headers, PUT body and no cookies', async () => {
  let called = false
  assert.equal(
    await uploadMediaFile(file, upload, async (url, options) => {
      called = true
      assert.equal(url, upload.uploadUrl)
      assert.deepEqual(options, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: file,
        credentials: 'omit',
        redirect: 'error',
      })
      return new Response(null, { status: 200 })
    }),
    upload.uploadHref
  )
  assert.equal(called, true)
})

test('forwards Azure required headers unchanged', async () => {
  await uploadMediaFile(
    file,
    {
      ...upload,
      uploadHeaders: [
        ...upload.uploadHeaders,
        { name: 'x-ms-blob-type', value: 'BlockBlob' },
      ],
    },
    async (_, options) => {
      assert.equal(options.headers['x-ms-blob-type'], 'BlockBlob')
      return new Response(null, { status: 201 })
    }
  )
})

test('rejects missing reservations, HTTP errors and transport failures', async () => {
  await assert.rejects(uploadMediaFile(file, null), /could not be prepared/)
  for (const status of [400, 403, 500]) {
    await assert.rejects(
      uploadMediaFile(
        file,
        upload,
        async () => new Response('private provider details', { status })
      ),
      { message: 'Media upload failed' }
    )
  }
  await assert.rejects(
    uploadMediaFile(file, upload, async () => {
      throw new TypeError('network failure')
    }),
    /network failure/
  )
})
