import clsx from 'clsx'
import React from 'react'
import { ArrowRightIcon } from '@heroicons/react/solid'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'

interface ImageTextBlockProps {
  title: string
  text: any
  imgSrc: string
  link?: string
  linkText?: string
  className?: string
}
const ImageTextBlock = ({
  title,
  text,
  imgSrc,
  link,
  linkText,
  className,
}: ImageTextBlockProps) => {
  return (
    <div
      className={clsx(
        className,
        'grid grid-cols-1 md:grid-cols-2 p-3 border-2 border-solid border-gray-300 rounded-lg w-full'
      )}
    >
      <div className="order-1 w-full px-2 mx-auto mt-2 mb-4 text-center md:px-6 md:my-auto md:order-0">
        <Zoom overlayBgColorEnd="gray">
          <img src={imgSrc} className={'max-h-80 shadow-md'} />
        </Zoom>
      </div>
      <div className="relative w-full order-0 md:order-1">
        <div className="mb-2 text-lg font-bold sm:text-xl">{title}</div>
        <div className="mb-3">{text}</div>
        {link && linkText && (
          <a href={link} className="hidden md:block">
            <ArrowRightIcon className="h-5 align-text-bottom" /> {linkText}
          </a>
        )}
      </div>
      {link && linkText && (
        <a href={link} className="order-2 block md:hidden">
          <ArrowRightIcon className="h-5 align-text-bottom" /> {linkText}
        </a>
      )}
    </div>
  )
}

export default ImageTextBlock
