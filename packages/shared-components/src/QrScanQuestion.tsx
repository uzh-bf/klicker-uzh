import { Markdown } from '@klicker-uzh/markdown'
import { isValidQrScanCode, normalizeQrScanCode } from '@klicker-uzh/types'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}

export default function QrScanQuestion({
  content,
  response,
  setResponse,
  disabled = false,
}: {
  content: string
  response?: string
  setResponse: (value: string, valid: boolean) => void
  disabled?: boolean
}) {
  const t = useTranslations()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const acquisitionRef = useRef(0)
  const startingRef = useRef(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError] = useState(false)

  const stopCamera = useCallback(() => {
    acquisitionRef.current += 1
    startingRef.current = false
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraActive(false)
    setCameraStarting(false)
  }, [])

  useEffect(() => stopCamera, [stopCamera])
  useEffect(() => {
    if (disabled) stopCamera()
  }, [disabled, stopCamera])

  const startCamera = async () => {
    if (startingRef.current || cameraActive || disabled) return
    startingRef.current = true
    setCameraStarting(true)
    const acquisition = ++acquisitionRef.current
    setCameraError(false)
    const Detector = (
      globalThis as typeof globalThis & {
        BarcodeDetector?: new (options: {
          formats: string[]
        }) => BarcodeDetectorInstance
      }
    ).BarcodeDetector
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      startingRef.current = false
      setCameraStarting(false)
      setCameraError(true)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })
      if (acquisition !== acquisitionRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return stopCamera()
      video.srcObject = stream
      await video.play()
      if (
        acquisition !== acquisitionRef.current ||
        streamRef.current !== stream
      ) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      startingRef.current = false
      setCameraStarting(false)
      setCameraActive(true)
      const detector = new Detector({ formats: ['qr_code'] })
      const scan = async () => {
        try {
          const codes = await detector.detect(video)
          if (!streamRef.current) return
          const value = normalizeQrScanCode(codes[0]?.rawValue)
          if (isValidQrScanCode(value)) {
            setResponse(value, true)
            stopCamera()
            return
          }
          frameRef.current = requestAnimationFrame(scan)
        } catch {
          stopCamera()
          setCameraError(true)
        }
      }
      frameRef.current = requestAnimationFrame(scan)
    } catch {
      stopCamera()
      setCameraError(true)
    }
  }

  return (
    <div className="space-y-4">
      <Markdown content={content} />
      <video
        ref={videoRef}
        className={cameraActive ? 'w-full rounded bg-black' : 'hidden'}
        playsInline
        muted
        data-cy="qr-scanner-video"
      />
      <button
        type="button"
        className="rounded bg-slate-800 px-4 py-2 font-semibold text-white disabled:opacity-50"
        disabled={disabled || cameraStarting}
        data-cy="start-qr-scanner"
        onClick={cameraActive ? stopCamera : startCamera}
      >
        {cameraActive
          ? t('shared.QR_SCAN.stopCamera')
          : t('shared.QR_SCAN.startCamera')}
      </button>
      {cameraError ? (
        <p role="status" className="text-sm text-amber-700">
          {t('shared.QR_SCAN.cameraFallback')}
        </p>
      ) : null}
      <label className="block text-sm font-semibold">
        {t('shared.QR_SCAN.manualLabel')}
        <input
          className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-mono"
          value={response ?? ''}
          disabled={disabled}
          autoComplete="off"
          data-cy="qr-manual-code"
          onChange={(event) => {
            const value = normalizeQrScanCode(event.target.value)
            setResponse(value, isValidQrScanCode(value))
          }}
        />
      </label>
    </div>
  )
}
