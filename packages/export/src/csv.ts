import { createWriteStream } from 'node:fs'

function escapeCsvValue(val: unknown): string {
  if (val == null) return ''
  // Normalize embedded newlines to spaces so every logical row is one physical
  // line (line tools / naive editors stay correct); rich multi-line content
  // remains intact in the XLSX. The CR/LF quoting below is kept as a backstop.
  const str = String(val).replace(/\r\n|\r|\n/g, ' ')
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
    // UTF-8 BOM so Excel (esp. DE/Windows locale) opens with correct encoding.
    stream.write('﻿')
    stream.write(headers.map(escapeCsvValue).join(',') + '\n')
    for (const row of rows) {
      stream.write(row.map(escapeCsvValue).join(',') + '\n')
    }
    stream.end(resolve)
  })
}
