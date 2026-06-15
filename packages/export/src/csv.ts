import { createWriteStream } from 'node:fs'

function escapeCsvValue(val: unknown): string {
  if (val == null) return ''
  const str = String(val)
  const sanitized = /^\s*[=+\-@]/.test(str) ? `'${str}` : str
  if (
    sanitized.includes(',') ||
    sanitized.includes('"') ||
    sanitized.includes('\n') ||
    sanitized.includes('\r')
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`
  }
  return sanitized
}

export async function writeCsv(
  filePath: string,
  headers: string[],
  rows: unknown[][]
): Promise<void> {
  return new Promise((resolve, reject) => {
    // mode 0o600 at creation time: PII-bearing files are owner-only even on
    // hosts with a permissive umask (the chmod in exportCourse.ts is a backstop).
    const stream = createWriteStream(filePath, {
      encoding: 'utf-8',
      mode: 0o600,
    })
    stream.on('error', reject)
    stream.write(headers.map(escapeCsvValue).join(',') + '\n')
    for (const row of rows) {
      stream.write(row.map(escapeCsvValue).join(',') + '\n')
    }
    stream.end(resolve)
  })
}
