import clsx from 'clsx'
import React from 'react'

interface ImageTileProps {
  imgSrc: string
  content: string
  className?: string
}

const ImageTile = ({ imgSrc, content, className }: ImageTileProps) => {
  return (
    <div className={clsx(className, 'text-center md:w-1/3')}>
      <div className="relative md:h-60 lg:h-80">
        <img
          src={imgSrc}
          className="top-0 bottom-0 left-0 right-0 max-w-full m-auto md:absolute md:max-w-full md:max-h-full max-h-80"
        />
      </div>
      <div className="mt-2 text-xl font-bold">{content}</div>
    </div>
  )
}

export default ImageTile
