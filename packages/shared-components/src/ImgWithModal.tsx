import { faExpand } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal } from '@uzh-bf/design-system'
import Image from 'next/image'
import React, { useState } from 'react'

export default function ImgWithModal({
  src,
  alt,
  width,
  height,
}: {
  src: string
  alt?: string
  width?: number
  height?: number
}) {
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
              width={width ?? 400}
              height={height ?? 300}
            />
            <Button
              className={{ root: 'absolute top-1 right-1' }}
              onClick={() => setIsOpen(true)}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faExpand} />
              </Button.Icon>
            </Button>
          </div>
          {alt && <div className="text-sm text-slate-600">{alt}</div>}
        </div>
      }
      onClose={() => setIsOpen(false)}
      title={alt}
    >
      <div className="relative w-full h-full">
        <Image src={src} alt="Image" fill className="object-contain" />
      </div>
    </Modal>
  )
}
