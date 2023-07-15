import React from 'react'
import { twMerge } from 'tailwind-merge'

import Image from '@theme/IdealImage'

interface ImageTileProps {
  imgSrc: string
  content: string
  className?: string
  imgClassName?: string
}

const ImageTile = ({
  imgSrc,
  content,
  className,
  imgClassName,
}: ImageTileProps) => {
  return (
    <div className={twMerge(className, 'text-center md:w-1/3')}>
      <div className="relative md:h-60 lg:h-80">
        <Image
          img={imgSrc}
          className={twMerge(
            'bottom-0 left-0 right-0 top-0 m-auto max-h-64 max-w-full md:absolute md:max-h-full md:max-w-full',
            imgClassName
          )}
        />
      </div>
      <div className="mt-4 text-xl font-bold md:mt-8">{content}</div>
    </div>
  )
}

export default ImageTile
