import {
  computeWordCloudLayout,
  renderWordCloud,
  type LayoutResult,
  type LayoutWord,
  type RendererHandle,
  type WordCloudWord,
} from '@klicker-uzh/word-cloud'
import { useEffect, useMemo, useRef, useState } from 'react'

interface NativeD3WordCloudProps {
  words: WordCloudWord[]
  minTextSize: number
  maxTextSize: number
  fontFamily: string
  colors: string[]
  transitionDuration: number
  emptyStateText: string
  getWordTooltip: (word: LayoutWord) => Node
  rotationAngles?: [number, number]
  onLayoutChange?: (result: LayoutResult) => void
}

function NativeD3WordCloud({
  words,
  minTextSize,
  maxTextSize,
  fontFamily,
  colors,
  transitionDuration,
  emptyStateText,
  getWordTooltip,
  rotationAngles = [0, -90],
  onLayoutChange,
}: NativeD3WordCloudProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<RendererHandle | null>(null)
  const [containerSize, setContainerSize] = useState({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const updateSize = () => {
      const nextSize = {
        width: Math.max(0, Math.floor(container.clientWidth)),
        height: Math.max(0, Math.floor(container.clientHeight)),
      }
      setContainerSize((previous) =>
        previous.width === nextSize.width && previous.height === nextSize.height
          ? previous
          : nextSize
      )
    }

    updateSize()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [])

  const layoutResult = useMemo<LayoutResult | null>(() => {
    if (containerSize.width <= 0 || containerSize.height <= 0) {
      return null
    }

    return computeWordCloudLayout(words, {
      width: containerSize.width,
      height: containerSize.height,
      minFontSize: minTextSize,
      maxFontSize: maxTextSize,
      scale: 'log',
      spiral: 'archimedean',
      deterministic: true,
      seed: '42',
      padding: 5,
      rotations: 2,
      rotationAngles,
      fontFamily,
      shrinkFactor: 0.95,
      maxRelayouts: 10,
      maxAttemptsPerWord: 1500,
    })
  }, [
    containerSize.height,
    containerSize.width,
    fontFamily,
    maxTextSize,
    minTextSize,
    rotationAngles,
    words,
  ])

  useEffect(() => {
    if (layoutResult) {
      onLayoutChange?.(layoutResult)
    }
  }, [layoutResult, onLayoutChange])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    if (!layoutResult) {
      rendererRef.current?.destroy()
      rendererRef.current = null
      return
    }

    if (!rendererRef.current) {
      rendererRef.current = renderWordCloud(container, layoutResult, {
        colors,
        transitionDuration,
        fontFamily,
        getWordTooltip,
      })
      return
    }

    rendererRef.current.update(layoutResult, {
      colors,
      transitionDuration,
      fontFamily,
      getWordTooltip,
    })
  }, [colors, fontFamily, getWordTooltip, layoutResult, transitionDuration])

  useEffect(() => {
    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [])

  const showEmptyState =
    words.length > 0 && !!layoutResult && layoutResult.placed.length === 0

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {showEmptyState && (
        <div className="absolute inset-0 z-10 flex h-full w-full items-center justify-center text-center text-xl">
          {emptyStateText}
        </div>
      )}
    </div>
  )
}

export default NativeD3WordCloud
