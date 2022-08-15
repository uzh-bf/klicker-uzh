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
            'top-0 bottom-0 left-0 right-0 max-w-full m-auto md:absolute md:max-w-full md:max-h-full max-h-64',
            imgClassName
          )}
        />
      </div>
      <div className="mt-4 text-xl font-bold md:mt-8">{content}</div>
    </div>
  )
}

export default ImageTile
