import { faExpand } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal } from '@uzh-bf/design-system'
import React, { useState } from 'react'
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
}

function ImgWithModal({
  src,
  alt,
  width,
  height,
  className,
  withModal = true,
}: ImgWithModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Modal
      fullScreen
      open={isOpen}
      trigger={
        <div className="mb-1 flex flex-col items-start">
          <div className="relative">
            <img
              src={src}
              alt="Image"
              height="0"
              width="0"
              className={twMerge(
                'max-h-64 min-h-36 w-auto rounded object-contain shadow',
                className?.img
              )}
              style={{ width, height }}
              sizes="100vw"
            />
            {withModal && (
              <Button
                className={{
                  root: 'absolute right-2 top-2 text-sm',
                }}
                onClick={() => setIsOpen(true)}
                data={{ cy: `close-image-modal` }}
              >
                <Button.Icon>
                  <FontAwesomeIcon icon={faExpand} />
                </Button.Icon>
              </Button>
            )}
          </div>
          {alt && <div className="text-sm text-slate-600">{alt}</div>}
        </div>
      }
      onClose={() => setIsOpen(false)}
      title={alt}
      className={{ content: className?.modal }}
    >
      <div className="relative h-full w-full">
        <img src={src} alt="Image" className="object-contain" />
      </div>
    </Modal>
  )
}

export default ImgWithModal
