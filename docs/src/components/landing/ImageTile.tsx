import clsx from 'clsx'
import React from 'react'

interface ImageTileProps {
  imgSrc: string
  content: string
  className?: string
}

const ImageTile = ({ imgSrc, content, className }: ImageTileProps) => {
  return (
    <div className={clsx(className, 'text-center w-1/3')}>
      <img src={imgSrc} className="h-80" />
      <div className="mt-2 text-xl font-bold">{content}</div>
    </div>
  )
}

export default ImageTile
