import type { MIssueCredentialMutation } from '@klicker-uzh/graphql/dist/ops'
import { getHistogramBinGeometry, isScoreInHistogramBin } from './histogram'

type AssessmentReportSnapshot =
  MIssueCredentialMutation['issueAssessmentReport']['snapshot']

export interface ExportReportTexts {
  documentTitle: string
  issuedAt: string
  timeZone: string
  course: string
  courseReference: string
  studentName: string
  studentEmail: string
  matriculationNumber: string
  identitySource: string
  pointsSummary: string
  achieved: string
  available: string
  basePoints: string
  correctnessPoints: string
  bonusPoints: string
  totalPoints: string
  comparisonTitle: string
  percentileText: string
  percentileExplanation: string
  histogramTitle: string
  histogramDescription: string
  histogramUserRange: string
  noComparison: string
  privacyTitle: string
  privacyText: string
  scoreRange: string
  participantCount: string
  yourScore: string
  verificationTitle: string
  verificationText: string
  verificationLink: string
  verificationQrAlt: string
}

export interface AssessmentReportArtifact {
  url: string
  html: string
}

const REPORT_TIME_ZONE = 'Europe/Zurich'

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}

function escapeHtml(value: string | number) {
  return String(value).replace(/[&<>"']/g, (character) => {
    return HTML_ENTITIES[character]!
  })
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
    value
  )
}

function createHistogramSvg({
  histogram,
  totalPoints,
  availableTotalPoints,
  texts,
  locale,
}: {
  histogram: NonNullable<AssessmentReportSnapshot['comparison']>['histogram']
  totalPoints: number
  availableTotalPoints: number
  texts: ExportReportTexts
  locale: string
}) {
  const width = 640
  const height = 300
  const top = 36
  const bottom = 58
  const left = 52
  const right = 20
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const maxCount = Math.max(...histogram.map((bin) => bin.count), 1)
  const userBinIndex = histogram.findIndex((bin, index) => {
    return isScoreInHistogramBin({
      score: totalPoints,
      bin,
      isLast: index === histogram.length - 1,
      availableTotalPoints,
    })
  })

  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4
    const y = top + plotHeight - ratio * plotHeight
    const count = Math.round(ratio * maxCount)
    return `<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#d6d6d6" />
      <text x="${left - 8}" y="${y + 4}" text-anchor="end">${count}</text>`
  }).join('')

  const bars = histogram
    .map((bin, index) => {
      const barHeight = (bin.count / maxCount) * plotHeight
      const { startRatio, widthRatio } = getHistogramBinGeometry(
        histogram,
        index
      )
      const slotX = left + startRatio * plotWidth
      const slotWidth = widthRatio * plotWidth
      const gap = Math.min(8, slotWidth * 0.2)
      const x = slotX + gap / 2
      const barWidth = Math.max(slotWidth - gap, 1)
      const y = top + plotHeight - barHeight
      const isUserBin = index === userBinIndex
      const color = isUserBin ? '#0028a5' : '#007a92'
      const range = `${formatNumber(bin.binStart, locale)}-${formatNumber(
        bin.binEnd,
        locale
      )}`
      return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" />
        <text x="${x + barWidth / 2}" y="${y - 7}" text-anchor="middle" font-weight="600">${bin.count}</text>
        <text x="${x + barWidth / 2}" y="${top + plotHeight + 20}" text-anchor="middle" font-size="10">${escapeHtml(range)}</text>
        ${
          isUserBin
            ? `<text x="${x + barWidth / 2}" y="${y - 22}" text-anchor="middle" fill="#0028a5" font-weight="700">${escapeHtml(texts.yourScore)}</text>`
            : ''
        }`
    })
    .join('')

  const accessibleDescription = [
    texts.histogramDescription,
    texts.histogramUserRange,
  ]
    .filter(Boolean)
    .join(' ')

  return `<svg role="img" aria-label="${escapeHtml(accessibleDescription)}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <g fill="#333" font-family="Arial, sans-serif" font-size="11">
      ${grid}
      <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#666" />
      ${bars}
      <text x="${left + plotWidth / 2}" y="${height - 8}" text-anchor="middle">${escapeHtml(texts.scoreRange)}</text>
      <text x="14" y="${top + plotHeight / 2}" text-anchor="middle" transform="rotate(-90 14 ${top + plotHeight / 2})">${escapeHtml(texts.participantCount)}</text>
    </g>
  </svg>`
}

function createHistogramTable(
  snapshot: AssessmentReportSnapshot,
  texts: ExportReportTexts,
  locale: string
) {
  if (!snapshot.comparison) return ''
  const rows = snapshot.comparison.histogram
    .map((bin, index, histogram) => {
      const isUserBin = isScoreInHistogramBin({
        score: snapshot.results.totalPoints,
        bin,
        isLast: index === histogram.length - 1,
        availableTotalPoints: snapshot.results.availableTotalPoints,
      })
      return `<tr${isUserBin ? ' class="user-bin"' : ''}>
        <td>${escapeHtml(formatNumber(bin.binStart, locale))}-${escapeHtml(formatNumber(bin.binEnd, locale))}${isUserBin ? ` <span class="user-bin-label">(${escapeHtml(texts.yourScore)})</span>` : ''}</td>
        <td>${bin.count}</td>
      </tr>`
    })
    .join('')
  return `<table class="histogram-table">
    <thead><tr><th>${escapeHtml(texts.scoreRange)}</th><th>${escapeHtml(texts.participantCount)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`
}

export async function loadPublicImageAsDataUrl(path: string) {
  const response = await fetch(path)
  if (!response.ok) throw new Error('REPORT_ASSET_UNAVAILABLE')
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result)))
    reader.addEventListener('error', () => reject(reader.error))
    reader.readAsDataURL(blob)
  })
}

export function createAssessmentReport({
  snapshot,
  issuedAt,
  identitySourceLabel,
  locale,
  texts,
  verificationUrl,
  qrCodeDataUrl,
  uzhLogoDataUrl,
}: {
  snapshot: AssessmentReportSnapshot
  issuedAt: string | Date
  identitySourceLabel: string
  locale: string
  texts: ExportReportTexts
  verificationUrl: string
  qrCodeDataUrl: string
  uzhLogoDataUrl: string
}): AssessmentReportArtifact {
  const formattedIssuedAt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: REPORT_TIME_ZONE,
  }).format(new Date(issuedAt))
  const studentName = [snapshot.subject.givenName, snapshot.subject.surname]
    .filter((value): value is string => Boolean(value))
    .join(' ')
  const matriculationNumber = snapshot.subject.matriculationNumber
  const resultRows = [
    [
      texts.basePoints,
      snapshot.results.basePoints,
      snapshot.results.availableBasePoints,
    ],
    [
      texts.correctnessPoints,
      snapshot.results.correctnessPoints,
      snapshot.results.availableCorrectnessPoints,
    ],
    [
      texts.bonusPoints,
      snapshot.results.bonusPoints,
      snapshot.results.availableBonusPoints,
    ],
    [
      texts.totalPoints,
      snapshot.results.totalPoints,
      snapshot.results.availableTotalPoints,
    ],
  ]
    .map(
      ([label, achieved, available]) => `<tr>
        <th scope="row">${escapeHtml(label)}</th>
        <td>${escapeHtml(formatNumber(Number(achieved), locale))}</td>
        <td>${escapeHtml(formatNumber(Number(available), locale))}</td>
      </tr>`
    )
    .join('')

  const comparison = snapshot.comparison
    ? `<p class="percentile">${escapeHtml(texts.percentileText)}</p>
       <p>${escapeHtml(texts.percentileExplanation)}</p>
       <h3>${escapeHtml(texts.histogramTitle)}</h3>
       <p>${escapeHtml(texts.histogramDescription)}</p>
       <div class="chart">${createHistogramSvg({
         histogram: snapshot.comparison.histogram,
         totalPoints: snapshot.results.totalPoints,
         availableTotalPoints: snapshot.results.availableTotalPoints,
         texts,
         locale,
       })}</div>
       ${createHistogramTable(snapshot, texts, locale)}`
    : `<p>${escapeHtml(texts.noComparison)}</p>`

  const html = `<!doctype html>
<html lang="${escapeHtml(locale)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="no-referrer" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" />
  <title>${escapeHtml(texts.documentTitle)} - ${escapeHtml(snapshot.course.displayName)}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #1a1a1a; font-family: "Source Sans 3", "Source Sans Pro", Arial, sans-serif; line-height: 1.45; }
    main { max-width: 960px; margin: 0 auto; padding: 40px; }
    header { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; border-bottom: 4px solid #0028a5; padding-bottom: 20px; }
    .brand { display: flex; align-items: center; gap: 20px; }
    .brand img { display: block; width: 184px; height: auto; }
    .product { border-left: 1px solid #b3b3b3; padding-left: 20px; font-size: 18px; font-weight: 700; }
    h1 { margin: 0; font-size: 22px; line-height: 1.15; }
    h2 { margin: 34px 0 12px; border-bottom: 1px solid #b3b3b3; padding-bottom: 7px; color: #0028a5; font-size: 18px; }
    h3 { margin: 24px 0 8px; font-size: 15px; }
    p { margin: 8px 0; }
    .issued { margin-top: 6px; color: #555; text-align: right; }
    dl { display: grid; grid-template-columns: minmax(150px, 1fr) 2fr; margin: 20px 0 0; border-top: 1px solid #d6d6d6; }
    dt, dd { margin: 0; border-bottom: 1px solid #d6d6d6; padding: 10px 12px; }
    dd { overflow-wrap: anywhere; }
    dt { background: #f3f4f6; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border-bottom: 1px solid #d6d6d6; padding: 10px 12px; text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    thead th { background: #f3f4f6; }
    .results-table tbody tr:last-child { background: #eef3ff; font-weight: 700; }
    .percentile { border-left: 4px solid #0028a5; padding: 10px 14px; color: #0028a5; font-size: 18px; font-weight: 700; }
    .chart { overflow-x: auto; }
    .chart svg { display: block; min-width: 620px; width: 100%; height: auto; }
    .histogram-table { font-size: 14px; }
    .histogram-table .user-bin { background: #eef3ff; font-weight: 700; }
    .user-bin-label { margin-left: 6px; color: #0028a5; }
    .verification { display: grid; grid-template-columns: 120px 1fr; gap: 22px; align-items: center; margin-top: 36px; border-top: 2px solid #0028a5; border-bottom: 2px solid #0028a5; padding: 20px 0; }
    .verification img { width: 120px; height: 120px; }
    .verification a { color: #0028a5; overflow-wrap: anywhere; }
    .privacy { margin-top: 28px; border-left: 4px solid #007a92; padding-left: 14px; color: #444; }
    @media (max-width: 680px) { main { padding: 24px; } header { align-items: flex-start; flex-direction: column; } .issued { text-align: left; } dl { grid-template-columns: 1fr; } dt { border-bottom: 0; } .verification { grid-template-columns: 1fr; } }
    @media print {
      @page { size: A4 portrait; margin: 12mm; }
      body { font-size: 12px; line-height: 1.3; }
      main { max-width: none; margin: 0; padding: 0; font-size: 12px; line-height: 1.3; }
      header { gap: 12px; border-bottom-width: 2px; padding-bottom: 8px; }
      .brand { gap: 8px; }
      .brand img { width: 130px; }
      .product { padding-left: 8px; font-size: 12px; }
      h1 { font-size: 16px; }
      h2 { margin: 10px 0 5px; padding-bottom: 3px; font-size: 13px; }
      h3 { margin: 8px 0 4px; font-size: 12px; }
      p { margin: 4px 0; }
      .issued { margin-top: 3px; font-size: 9px; }
      dl { grid-template-columns: 140px 1fr; margin-top: 10px; }
      dt, dd { padding: 4px 7px; }
      table { margin-top: 5px; }
      th, td { padding: 3px 7px; }
      .percentile { padding: 5px 8px; font-size: 12px; }
      .chart { overflow: visible; }
      .chart svg { min-width: 0; width: 100%; max-width: 420px; height: auto; margin: 0 auto; }
      .histogram-table { margin-top: 4px; font-size: 8px; }
      .histogram-table th, .histogram-table td { padding: 2px 5px; }
      .verification { grid-template-columns: 72px 1fr; gap: 10px; margin-top: 10px; border-width: 1px; padding: 6px 0; }
      .verification img { width: 72px; height: 72px; }
      .verification h2 { margin: 0 0 3px; }
      .privacy { margin-top: 8px; border-left-width: 2px; padding-left: 8px; font-size: 9px; }
      .privacy h3 { font-size: 10px; }
      .chart, .verification, .pdf-avoid { break-inside: avoid; }
    }

  </style>
</head>
<body>
<main>
  <header>
    <div class="brand">
      <img src="${escapeHtml(uzhLogoDataUrl)}" alt="Universität Zürich" />
      <div class="product">KlickerUZH</div>
    </div>
    <div>
      <h1>${escapeHtml(texts.documentTitle)}</h1>
      <div class="issued">${escapeHtml(texts.issuedAt)}: ${escapeHtml(formattedIssuedAt)} (${escapeHtml(texts.timeZone)})</div>
    </div>
  </header>

  <dl>
    <dt>${escapeHtml(texts.course)}</dt><dd>${escapeHtml(snapshot.course.displayName)}</dd>
    <dt>${escapeHtml(texts.courseReference)}</dt><dd>${escapeHtml(snapshot.course.name)}</dd>
    ${studentName ? `<dt>${escapeHtml(texts.studentName)}</dt><dd>${escapeHtml(studentName)}</dd>` : ''}
    <dt>${escapeHtml(texts.studentEmail)}</dt><dd>${escapeHtml(snapshot.subject.email)}</dd>
    ${matriculationNumber ? `<dt>${escapeHtml(texts.matriculationNumber)}</dt><dd>${escapeHtml(matriculationNumber)}</dd>` : ''}
    <dt>${escapeHtml(texts.identitySource)}</dt><dd>${escapeHtml(identitySourceLabel)}</dd>
  </dl>

    <section class="pdf-avoid">
    <h2>${escapeHtml(texts.pointsSummary)}</h2>
    <table class="results-table">
      <thead><tr><th></th><th>${escapeHtml(texts.achieved)}</th><th>${escapeHtml(texts.available)}</th></tr></thead>
      <tbody>${resultRows}</tbody>
    </table>
  </section>

    <section class="pdf-avoid">
    <h2>${escapeHtml(texts.comparisonTitle)}</h2>
    ${comparison}
  </section>

    <section class="verification pdf-avoid">
    <img src="${escapeHtml(qrCodeDataUrl)}" alt="${escapeHtml(texts.verificationQrAlt)}" />
    <div>
      <h2>${escapeHtml(texts.verificationTitle)}</h2>
      <p>${escapeHtml(texts.verificationText)}</p>
      <a href="${escapeHtml(verificationUrl)}" rel="noreferrer">${escapeHtml(texts.verificationLink)}</a>
    </div>
  </section>

  <section class="privacy">
    <h3>${escapeHtml(texts.privacyTitle)}</h3>
    <p>${escapeHtml(texts.privacyText)}</p>
  </section>
</main>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })

  return {
    url: URL.createObjectURL(blob),
    html,
  }
}
