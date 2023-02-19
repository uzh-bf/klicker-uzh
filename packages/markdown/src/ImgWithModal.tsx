import { faExpand } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal } from '@uzh-bf/design-system'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'

// IMPORTANT: keep the import with .js, otherwise docker build will fail to resolve the module
import Image from 'next/image.js'
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
        <div className="flex flex-col items-start mb-1">
          <div className="relative">
            <Image
              src={src}
              alt="Image"
              height="0"
              width="0"
              className={twMerge(
                'object-contain w-auto min-h-36 max-h-64 rounded shadow',
                className?.img
              )}
              style={{ width, height }}
              sizes="100vw"
            />
            {withModal && (
              <Button
                className={{
                  root: 'absolute top-2 right-2 text-sm',
                }}
                onClick={() => setIsOpen(true)}
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
      <div className="relative w-full h-full">
        <Image src={src} alt="Image" fill className="object-contain" />
      </div>
    </Modal>
  )
}

export default ImgWithModal
