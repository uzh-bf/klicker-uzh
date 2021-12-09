import clsx from 'clsx'
import React from 'react'

interface ImageContentBlockProps {
  imgSrc: string
  content: any
  className?: string
}

const ImageContentBlock = ({
  imgSrc,
  content,
  className,
}: ImageContentBlockProps) => {
  return (
    <div
      className={clsx(
        className,
        'w-full h-64 rounded-lg flex flex-row border-2 border-solid border-gray-400'
      )}
    >
      <div className="w-1/2 h-64 p-2 text-center">
        <img src={imgSrc} className="object-contain h-60" />
      </div>
      <div className="w-1/2">{content}</div>
    </div>
  )
}

export default ImageContentBlock
