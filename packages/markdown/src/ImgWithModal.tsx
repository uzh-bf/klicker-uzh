import { faExpand } from '@fortawesome/free-solid-svg-icons'
import { Button, Modal } from '@uzh-bf/design-system'
import type { MouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

// IMPORTANT: keep the import with .js, otherwise docker build will fail to resolve the module
export interface ImgWithModalProps {
  src: string
  alt?: string
  width?: number
  height?: number
  className?: {
    modal?: string
    img?: string
  }
  withModal: boolean
  expandLabel?: string
}

function ImgWithModal({
  src,
  alt,
  width,
  height,
  className,
  withModal = true,
  expandLabel,
}: ImgWithModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const expansionButtonRef = useRef<HTMLButtonElement | null>(null)
  const modalContentRef = useRef<HTMLDivElement | null>(null)
  const imageAlt = alt ?? 'Image'
  const resolvedExpandLabel = expandLabel || alt || 'Expand image'

  const handleOpen = (event?: MouseEvent<HTMLButtonElement>) => {
    if (event) expansionButtonRef.current = event.currentTarget
    setIsOpen(true)
  }

  useEffect(() => {
    if (!isOpen) return
    const frame = requestAnimationFrame(() => modalContentRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [isOpen])

  const handleClose = () => {
    setIsOpen(false)
    requestAnimationFrame(() => expansionButtonRef.current?.focus())
  }

  return (
    <div className="mb-1 flex flex-col items-start">
      <div className="relative">
        <img
          src={src}
          alt={imageAlt}
          height="0"
          width="0"
          className={twMerge(
            'max-h-64 min-h-36 w-auto rounded-sm object-contain shadow-sm',
            className?.img
          )}
          style={{ width, height }}
          sizes="100vw"
        />
        {withModal && (
          <Modal
            fullScreen
            open={isOpen}
            data={{ cy: 'close-image-modal' }}
            trigger={
              <button
                type="button"
                className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded border border-slate-300 bg-white text-sm hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-100"
                aria-label={resolvedExpandLabel}
                onClick={handleOpen}
              >
                <Button.Icon withoutLabel icon={faExpand} />
              </button>
            }
            title={resolvedExpandLabel}
            onClose={handleClose}
            className={{
              content: twMerge(className?.modal, 'h-max w-max'),
            }}
          >
            <div
              ref={modalContentRef}
              tabIndex={-1}
              className="relative h-full w-full"
            >
              <img src={src} alt={imageAlt} className="object-contain" />
            </div>
          </Modal>
        )}
      </div>
      {alt && <div className="text-sm text-slate-600">{alt}</div>}
    </div>
  )
}

export default ImgWithModal
