import {
  ElementStatus,
  ElementType,
  type Element,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import { processElementData } from '../src/elements.js'
import {
  generateQrScanCode,
  QR_SCAN_CODE_LENGTH,
  QR_SCAN_CODE_PATTERN,
} from '../src/qrScan.js'

describe('QR scan contracts', () => {
  it('generates unique fixed-length URL-safe opaque codes', () => {
    const codes = Array.from({ length: 1_000 }, generateQrScanCode)

    expect(new Set(codes)).toHaveLength(codes.length)
    expect(codes.every((code) => code.length === QR_SCAN_CODE_LENGTH)).toBe(
      true
    )
    expect(codes.every((code) => QR_SCAN_CODE_PATTERN.test(code))).toBe(true)
  })

  it('never copies the scan code into participant element data', () => {
    const element = {
      id: 1,
      version: 1,
      type: ElementType.QR_SCAN,
      status: ElementStatus.READY,
      name: 'Find the room code',
      content: 'Scan the code hidden in the room.',
      explanation: null,
      basePoints: true,
      pointsMultiplier: 1,
      options: {},
      qrScanCode: generateQrScanCode(),
    } as Element

    const data = processElementData(element)

    expect(data.type).toBe(ElementType.QR_SCAN)
    expect(data).not.toHaveProperty('qrScanCode')
    expect(JSON.stringify(data)).not.toContain(element.qrScanCode!)
  })
})
