export class MediaExportOmissionError extends Error {
  constructor(
    readonly kind: 'too-large' | 'unknown-size',
    readonly contentLength?: number
  ) {
    super('Media cannot be included in the export package.')
    this.name = 'MediaExportOmissionError'
  }
}
