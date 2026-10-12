import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { NextApiRequest, NextApiResponse } from 'next'

const assets = {
  guide: 'learning-analytics-students.html',
  'assessment-beispieldaten.xlsx': 'assessment-beispieldaten.xlsx',
  'forschung-beispieldaten.xlsx': 'forschung-beispieldaten.xlsx',
  'la-gruppenbericht-beispiel.xlsx': 'la-gruppenbericht-beispiel.xlsx',
} as const

export default async function dpoDraftAssets(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Cache-Control', 'no-store')
  if (process.env.NODE_ENV !== 'development') return res.status(404).end()
  const asset = req.query.asset
  if (typeof asset !== 'string' || !Object.hasOwn(assets, asset))
    return res.status(404).end()
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end()
  }
  const filename = assets[asset as keyof typeof assets]
  try {
    const content = await readFile(
      resolve(process.cwd(), '../../project/_local/dpo-draft-assets', filename)
    )
    res.setHeader('X-Content-Type-Options', 'nosniff')
    if (asset === 'guide') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
      )
      const html = content
        .toString('utf8')
        .replace('href="prototype.html"', 'href="/de/dpo-draft"')
        .replaceAll(
          'href="outputs/consent-la-download-examples/',
          'href="/api/dpo-draft-assets/'
        )
      return req.method === 'HEAD'
        ? res.status(200).end()
        : res.status(200).send(html)
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    return req.method === 'HEAD'
      ? res.status(200).end()
      : res.status(200).send(content)
  } catch {
    return res.status(404).end()
  }
}
