import {
  type PointerEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react'

type Size = { width: number; height: number }
type Axis = 'width' | 'height' | 'both'

/** Resize a bottom-right anchored panel without reserving header space. */
export default function FloatingPanelResizeHandles({
  panelRef,
  onResize,
  active,
  label,
  minWidth,
  minHeight,
  margin,
  breakpoint = 768,
}: {
  panelRef: RefObject<HTMLElement | null>
  onResize: (size: Size) => void
  active: boolean
  label: string
  minWidth: number
  minHeight: number
  margin: number
  breakpoint?: number
}) {
  const [measurement, setMeasurement] = useState<{
    size: Size
    viewport: Size
  } | null>(null)
  const session = useRef<{
    id: number
    axis: Axis
    x: number
    y: number
    size: Size
  } | null>(null)

  useEffect(() => {
    const panel = panelRef.current
    if (!active || !panel) return
    const measure = () => {
      const { width, height } = panel.getBoundingClientRect()
      setMeasurement({
        size: { width: Math.round(width), height: Math.round(height) },
        viewport: { width: window.innerWidth, height: window.innerHeight },
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
      session.current = null
    }
  }, [active, panelRef])

  if (!active || !measurement || measurement.viewport.width < breakpoint) {
    return null
  }
  const maxWidth = Math.max(0, measurement.viewport.width - margin)
  const maxHeight = Math.max(0, measurement.viewport.height - margin)
  const resize = (size: Size) => {
    onResize({
      width: Math.min(
        maxWidth,
        Math.max(Math.min(minWidth, maxWidth), size.width)
      ),
      height: Math.min(
        maxHeight,
        Math.max(Math.min(minHeight, maxHeight), size.height)
      ),
    })
  }
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (session.current?.id !== event.pointerId) return
    session.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <>
      {(['height', 'width', 'both'] as const).map((axis) => (
        <div
          key={axis}
          role={axis === 'both' ? undefined : 'separator'}
          aria-hidden={axis === 'both' ? true : undefined}
          aria-label={axis === 'both' ? undefined : label}
          aria-orientation={
            axis === 'height'
              ? 'horizontal'
              : axis === 'width'
                ? 'vertical'
                : undefined
          }
          aria-valuenow={axis === 'both' ? undefined : measurement.size[axis]}
          aria-valuemin={
            axis === 'height'
              ? Math.min(minHeight, maxHeight)
              : axis === 'width'
                ? Math.min(minWidth, maxWidth)
                : undefined
          }
          aria-valuemax={
            axis === 'height'
              ? maxHeight
              : axis === 'width'
                ? maxWidth
                : undefined
          }
          tabIndex={axis === 'both' ? undefined : 0}
          data-resize-axis={axis}
          className={`absolute left-0 top-0 z-20 touch-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${axis === 'height' ? 'right-0 h-1.5 cursor-ns-resize' : axis === 'width' ? 'bottom-0 w-1.5 cursor-ew-resize' : 'size-3.5 cursor-nwse-resize'}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return
            const rect = panelRef.current?.getBoundingClientRect()
            if (!rect) return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
            session.current = {
              id: event.pointerId,
              axis,
              x: event.clientX,
              y: event.clientY,
              size: { width: rect.width, height: rect.height },
            }
          }}
          onPointerMove={(event) => {
            const current = session.current
            if (!current || current.id !== event.pointerId) return
            resize({
              width:
                current.size.width -
                (current.axis === 'height' ? 0 : event.clientX - current.x),
              height:
                current.size.height -
                (current.axis === 'width' ? 0 : event.clientY - current.y),
            })
          }}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
          onKeyDown={(event) => {
            const delta =
              axis === 'width'
                ? (
                    { ArrowLeft: 16, ArrowRight: -16 } as Record<string, number>
                  )[event.key]
                : axis === 'height'
                  ? ({ ArrowUp: 16, ArrowDown: -16 } as Record<string, number>)[
                      event.key
                    ]
                  : undefined
            if (delta === undefined || axis === 'both') return
            event.preventDefault()
            resize({
              ...measurement.size,
              [axis]: measurement.size[axis] + delta,
            })
          }}
        />
      ))}
    </>
  )
}
