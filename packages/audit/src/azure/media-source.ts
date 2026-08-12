import { type TokenCredential } from '@azure/identity'
import { BlobClient } from '@azure/storage-blob'
import type {
  AuditMediaSource,
  AuditMediaSourceResult,
} from '../media/capture.js'
import { assertAllowedKlickerMediaSource } from '../media/content-address.js'
import type { OwnedBaselineMediaReference } from '../baseline/media-references.js'

export class AzureBlobAuditMediaSource implements AuditMediaSource {
  private readonly credential: TokenCredential
  private readonly allowedHosts: readonly string[]

  constructor(credential: TokenCredential, allowedHosts: readonly string[]) {
    this.credential = credential
    this.allowedHosts = allowedHosts
  }

  async open(
    reference: OwnedBaselineMediaReference
  ): Promise<AuditMediaSourceResult> {
    const sourceUrl = assertAllowedKlickerMediaSource(
      reference.sourceUrl,
      this.allowedHosts
    )
    const response = await new BlobClient(sourceUrl, this.credential).download()
    if (response.readableStreamBody === undefined) {
      throw new Error(`Klicker media ${reference.mediaId} returned no body`)
    }
    if (response.contentType === undefined) {
      throw new Error(`Klicker media ${reference.mediaId} has no MIME type`)
    }
    return {
      body: (async function* () {
        for await (const chunk of response.readableStreamBody!) {
          if (typeof chunk === 'string') {
            yield Buffer.from(chunk, 'utf8')
          } else {
            yield Buffer.from(chunk)
          }
        }
      })(),
      mimeType: response.contentType,
      contentLength: response.contentLength,
    }
  }
}
