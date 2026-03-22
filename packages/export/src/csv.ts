import { createWriteStream } from 'node:fs'

function escapeCsvValue(val: unknown): string {
  if (val == null) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function writeCsv(
  filePath: string,
  headers: string[],
  rows: unknown[][]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = createWriteStream(filePath, 'utf-8')
    stream.on('error', reject)
    stream.write(headers.map(escapeCsvValue).join(',') + '\n')
    for (const row of rows) {
      stream.write(row.map(escapeCsvValue).join(',') + '\n')
    }
    stream.end(resolve)
  })
}
