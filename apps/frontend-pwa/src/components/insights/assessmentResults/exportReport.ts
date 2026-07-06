import { HistogramBin } from '@klicker-uzh/types'

export interface ExportReportTexts {
  title: string
  subtitle: string
  course: string
  student: string
  date: string
  pointsSummary: string
  basePointsTitle: string
  correctnessPointsTitle: string
  bonusPointsTitle: string
  totalPointsTitle: string
  ofAvailable: string
  excludingBonus: string
  percentileTitle: string
  percentileText: string
  percentileExplanation: string
  histogramTitle: string
  histogramDescription: string
  privacyNoticeTitle: string
  privacyNoticeText: string
  yourScoreLabel: string
  countLabel: string
  binLabel: string
  notEnoughDataForComparison: string
}

export function downloadAssessmentReport({
  courseName,
  studentEmail,
  totalPoints,
  availableTotalPoints,
  basePoints,
  availableBasePoints,
  correctnessPoints,
  availableCorrectnessPoints,
  bonusPoints,
  availableBonusPoints,
  percentile,
  histogram,
  hasEnoughData,
  texts,
  verificationUrl = null,
  qrCodeDataUrl = null,
}: {
  courseName: string
  studentEmail: string
  totalPoints: number
  availableTotalPoints: number
  basePoints: number
  availableBasePoints: number
  correctnessPoints: number
  availableCorrectnessPoints: number
  bonusPoints: number
  availableBonusPoints: number
  percentile: number | null
  histogram: HistogramBin[] | null
  hasEnoughData: boolean
  texts: ExportReportTexts
  verificationUrl?: string | null
  qrCodeDataUrl?: string | null
}) {
  const formattedDate = new Date().toLocaleDateString(undefined, {
    dateStyle: 'medium',
  })

  // Format numbers nicely
  const formatNum = (val: number) =>
    Number.isInteger(val) ? val.toString() : val.toFixed(2)

  // Generate SVG Histogram
  let svgChart = ''
  if (hasEnoughData && histogram && histogram.length > 0) {
    svgChart = generateSvgHistogram(
      histogram,
      totalPoints,
      texts.yourScoreLabel,
      texts.countLabel,
      texts.binLabel
    )
  }

  // Construct HTML content
  const htmlContent = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${texts.title} - ${courseName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      color: #121212;
      background-color: #FFFFFF;
      margin: 0;
      padding: 40px;
      line-height: 1.6;
    }
    .header {
      border-bottom: 2px solid #0028A5;
      padding-bottom: 20px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .logo-wrapper {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    .logo-divider {
      width: 1px;
      height: 32px;
      background-color: #E9E9E9;
    }
    .logo-unit {
      font-size: 16px;
      font-weight: bold;
      color: #121212;
    }
    .document-title {
      font-size: 24px;
      font-weight: bold;
      margin: 0;
      color: #121212;
    }
    .meta-info {
      font-size: 14px;
      color: #666666;
      margin-top: 5px;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      color: #0028A5;
      border-bottom: 1px solid #E9E9E9;
      padding-bottom: 8px;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 25px;
      background-color: #FAFAFA;
      border: 1px solid #E9E9E9;
      border-radius: 8px;
      padding: 15px;
    }
    .info-item {
      font-size: 14px;
    }
    .info-label {
      font-weight: bold;
      color: #666666;
      margin-bottom: 3px;
    }
    .points-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    .points-card {
      border: 1px solid #E9E9E9;
      border-radius: 8px;
      padding: 15px;
      background-color: #FAFAFA;
      text-align: center;
    }
    .points-card.total {
      background-color: #F5F5FB;
      border-color: #0028A5;
    }
    .points-label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: bold;
      color: #666666;
      margin-bottom: 5px;
    }
    .points-value {
      font-size: 24px;
      font-weight: bold;
      color: #121212;
    }
    .points-card.total .points-value {
      color: #0028A5;
    }
    .points-meta {
      font-size: 12px;
      color: #4C4C4C;
      margin-top: 5px;
    }
    .percentile-box {
      background-color: #F5F5FB;
      border-left: 4px solid #0028A5;
      padding: 15px 20px;
      margin-bottom: 25px;
      border-radius: 0 8px 8px 0;
    }
    .percentile-title {
      font-size: 16px;
      font-weight: bold;
      color: #0028A5;
      margin-bottom: 5px;
    }
    .percentile-explanation {
      font-size: 14px;
      color: #4C4C4C;
    }
    .chart-container {
      text-align: center;
      margin: 30px 0;
      padding: 20px;
      border: 1px solid #E9E9E9;
      border-radius: 8px;
      background-color: #FAFAFA;
    }
    .chart-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 15px;
      color: #121212;
    }
    .privacy-box {
      font-size: 13px;
      color: #666666;
      background-color: #FAFAFA;
      border: 1px solid #E9E9E9;
      padding: 15px;
      border-radius: 6px;
      margin-top: 30px;
    }
    .privacy-title {
      font-weight: bold;
      color: #121212;
      margin-bottom: 5px;
    }
    .verification-footer {
      display: flex;
      align-items: center;
      gap: 20px;
      border: 2px dashed #0028A5;
      background-color: #F5F5FB;
      padding: 20px;
      border-radius: 8px;
      margin-top: 30px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .verification-qr {
      width: 100px;
      height: 100px;
      flex-shrink: 0;
      background-color: #FFFFFF;
      border: 1px solid #E9E9E9;
      padding: 5px;
      border-radius: 4px;
    }
    .verification-text {
      font-size: 13px;
      color: #121212;
      line-height: 1.4;
    }
    .verification-title {
      font-size: 15px;
      font-weight: bold;
      color: #0028A5;
      margin-bottom: 5px;
    }
    .verification-link {
      color: #0028A5;
      text-decoration: underline;
      font-weight: bold;
      word-break: break-all;
    }
    @media print {
      body {
        padding: 0;
      }
      .chart-container {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80" fill="none" style="height: 50px; width: auto; display: block;">
          <!-- Seal -->
          <circle cx="40" cy="40" r="36" stroke="#121212" stroke-width="2" fill="none"/>
          <circle cx="40" cy="40" r="30" stroke="#121212" stroke-width="1" fill="none"/>
          <text x="40" y="37" text-anchor="middle" font-family="Georgia, serif" font-size="7" fill="#121212" font-weight="bold">UNIVERSITAS</text>
          <text x="40" y="47" text-anchor="middle" font-family="Georgia, serif" font-size="7" fill="#121212" font-weight="bold">TURICENSIS</text>
          
          <!-- Separator line -->
          <line x1="88" y1="12" x2="88" y2="68" stroke="#121212" stroke-width="0.5"/>
          
          <!-- "Universität Zürich" text -->
          <text x="100" y="38" font-family="'Source Sans 3', 'Source Sans Pro', Arial, sans-serif" font-size="18" font-weight="400" fill="#121212">Universität Zürich</text>
          
          <!-- "UZH" acronym -->
          <text x="100" y="62" font-family="'Source Sans 3', 'Source Sans Pro', Arial, sans-serif" font-size="22" font-weight="bold" letter-spacing="2" fill="#121212">UZH</text>
        </svg>
        <div class="logo-divider"></div>
        <div class="logo-unit">KlickerUZH</div>
      </div>
    </div>
    <div style="text-align: right">
      <h1 class="document-title">${texts.title}</h1>
      <div class="meta-info">${texts.date}: ${formattedDate}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-item">
      <div class="info-label">${texts.course}</div>
      <div style="font-size: 16px; font-weight: bold;">${courseName}</div>
    </div>
    <div class="info-item">
      <div class="info-label">${texts.student}</div>
      <div style="font-size: 16px; font-weight: bold;">${studentEmail}</div>
    </div>
  </div>

  <div class="section-title">${texts.pointsSummary}</div>
  <div class="points-grid">
    <div class="points-card">
      <div class="points-label">${texts.basePointsTitle}</div>
      <div class="points-value">${formatNum(basePoints)}</div>
      <div class="points-meta">${texts.ofAvailable.replace('{value}', formatNum(availableBasePoints))}</div>
    </div>
    <div class="points-card">
      <div class="points-label">${texts.correctnessPointsTitle}</div>
      <div class="points-value">${formatNum(correctnessPoints)}</div>
      <div class="points-meta">${texts.ofAvailable.replace('{value}', formatNum(availableCorrectnessPoints))}</div>
    </div>
    <div class="points-card">
      <div class="points-label">${texts.bonusPointsTitle}</div>
      <div class="points-value">${formatNum(bonusPoints)}</div>
      <div class="points-meta">${texts.ofAvailable.replace('{value}', formatNum(availableBonusPoints))}</div>
    </div>
    <div class="points-card total">
      <div class="points-label">${texts.totalPointsTitle}</div>
      <div class="points-value">${formatNum(totalPoints)}</div>
      <div class="points-meta">
        ${texts.ofAvailable.replace('{value}', formatNum(availableTotalPoints))}<br>
        <span style="font-size: 10px; color: #666666;">${texts.excludingBonus.replace('{value}', formatNum(availableBasePoints + availableCorrectnessPoints))}</span>
      </div>
    </div>
  </div>

  ${
    hasEnoughData && percentile !== null
      ? `
  <div class="section-title">${texts.percentileTitle}</div>
  <div class="percentile-box">
    <div class="percentile-title">
      ${texts.percentileText.replace('{percentile}', percentile.toString())}
    </div>
    <div class="percentile-explanation">
      ${texts.percentileExplanation}
    </div>
  </div>

  <div class="chart-container">
    <div class="chart-title">${texts.histogramTitle}</div>
    <div style="margin-bottom: 15px; font-size: 14px; color: #4C4C4C;">${texts.histogramDescription}</div>
    <div style="display: inline-block;">
      ${svgChart}
    </div>
  </div>
  `
      : `
  <div class="section-title">${texts.percentileTitle}</div>
  <div class="percentile-box" style="border-left-color: #666666; background-color: #FAFAFA;">
    <div class="percentile-title" style="color: #666666;">
      ${texts.percentileTitle} (nicht verfügbar)
    </div>
    <div class="percentile-explanation">
      ${texts.notEnoughDataForComparison}
    </div>
  </div>
  `
  }

  ${
    verificationUrl && qrCodeDataUrl
      ? `
  <div class="verification-footer">
    <img src="${qrCodeDataUrl}" class="verification-qr" alt="Verification QR Code" />
    <div class="verification-text">
      <div class="verification-title">Offizielle Verifizierung / Official Verification</div>
      Dieser Leistungsbericht wurde digital signiert und kann auf KlickerUZH verifiziert werden.<br>
      This performance report is digitally signed and can be verified on KlickerUZH.<br>
      <a href="${verificationUrl}" class="verification-link" target="_blank" rel="noopener noreferrer">
        ${verificationUrl}
      </a>
    </div>
  </div>
  `
      : ''
  }

  <div class="privacy-box">
    <div class="privacy-title">${texts.privacyNoticeTitle}</div>
    <div>${texts.privacyNoticeText}</div>
  </div>
</body>
</html>`

  // Trigger file download
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute(
    'download',
    `KlickerUZH_Assessment_Report_${courseName.replace(/[^a-z0-9]/gi, '_')}.html`
  )
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function generateSvgHistogram(
  histogram: HistogramBin[],
  totalPoints: number,
  yourScoreLabel: string,
  countLabel: string,
  binLabel: string
): string {
  const width = 600
  const height = 300
  const topMargin = 40
  const bottomMargin = 50
  const leftMargin = 50
  const rightMargin = 20

  const plotWidth = width - leftMargin - rightMargin
  const plotHeight = height - topMargin - bottomMargin

  const maxCount = Math.max(...histogram.map((b) => b.count), 1)

  // Find user's bin index
  const userBinIndex = histogram.findIndex((bin) => {
    if (bin.binStart === histogram[histogram.length - 1]?.binStart) {
      return totalPoints >= bin.binStart && totalPoints <= bin.binEnd
    }
    return totalPoints >= bin.binStart && totalPoints < bin.binEnd
  })

  const binWidth = plotWidth / histogram.length
  const barWidth = binWidth - 6

  let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background-color: #FAFAFA; font-family: sans-serif;">`

  // Grid lines and Y axis ticks
  const ticks = 5
  for (let i = 0; i <= ticks; i++) {
    const yVal = topMargin + plotHeight - (i / ticks) * plotHeight
    const tickCount = Math.round((i / ticks) * maxCount)
    svgContent += `
      <line x1="${leftMargin}" y1="${yVal}" x2="${width - rightMargin}" y2="${yVal}" stroke="#E9E9E9" stroke-width="1" />
      <text x="${leftMargin - 10}" y="${yVal + 4}" fill="#666666" font-size="11" text-anchor="end">${tickCount}</text>
    `
  }

  // X axis line
  svgContent += `<line x1="${leftMargin}" y1="${topMargin + plotHeight}" x2="${width - rightMargin}" y2="${topMargin + plotHeight}" stroke="#666666" stroke-width="1" />`

  // Bars
  histogram.forEach((bin, i) => {
    const barHeight = (bin.count / maxCount) * plotHeight
    const x = leftMargin + i * binWidth + 3
    const y = topMargin + plotHeight - barHeight

    const isUserBin = i === userBinIndex
    const barColor = isUserBin ? '#0028A5' : '#4AC9E3'

    // Draw bar rect
    svgContent += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${barColor}" rx="3" />
    `

    // Bar count text above
    if (bin.count > 0) {
      svgContent += `
        <text x="${x + barWidth / 2}" y="${y - 6}" fill="${isUserBin ? '#0028A5' : '#4C4C4C'}" font-size="11" font-weight="${isUserBin ? 'bold' : 'normal'}" text-anchor="middle">${bin.count}</text>
      `
    }

    // Highlight label for User bin
    if (isUserBin) {
      svgContent += `
        <text x="${x + barWidth / 2}" y="${y - 18}" fill="#0028A5" font-size="10" font-weight="bold" text-anchor="middle">${yourScoreLabel}</text>
      `
    }

    // X axis ticks & labels
    const labelX = x + barWidth / 2
    const labelY = topMargin + plotHeight + 18
    const labelText = `${Math.round(bin.binStart)}-${Math.round(bin.binEnd)}`
    svgContent += `
      <text x="${labelX}" y="${labelY}" fill="#666666" font-size="9" text-anchor="middle" transform="rotate(-15, ${labelX}, ${labelY})">${labelText}</text>
    `
  })

  // Y-axis title
  svgContent += `
    <text x="15" y="${topMargin + plotHeight / 2}" fill="#666666" font-size="12" text-anchor="middle" transform="rotate(-90, 15, ${topMargin + plotHeight / 2})">${countLabel}</text>
  `
  // X-axis title
  svgContent += `
    <text x="${leftMargin + plotWidth / 2}" y="${height - 8}" fill="#666666" font-size="12" text-anchor="middle">${binLabel}</text>
  `

  svgContent += `</svg>`
  return svgContent
}
