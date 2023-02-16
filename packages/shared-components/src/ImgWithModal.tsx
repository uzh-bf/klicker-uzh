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
      className={{
        overlay: 'z-20',
        content: 'z-30',
      }}
      open={isOpen}
      trigger={
        <Button basic onClick={() => setIsOpen(true)}>
          <div className="flex flex-col items-start mb-1">
            <Image
              src={src}
              alt="Image"
              width={width ?? 250}
              height={height ?? 250}
            />
            {alt && <div className="text-sm text-slate-600">{alt}</div>}
          </div>
        </Button>
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
