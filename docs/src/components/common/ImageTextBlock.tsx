import { ArrowRightIcon } from '@heroicons/react/solid'
import Image from '@theme/IdealImage'
import React from 'react'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'
import { twMerge } from 'tailwind-merge'

interface ImageTextBlockProps {
  title: string
  text: any
  imgSrc: string
  link?: string
  linkText?: string
  className?: string
  imgClassName?: string
}
const ImageTextBlock = ({
  title,
  text,
  imgSrc,
  link,
  linkText,
  className,
  imgClassName,
}: ImageTextBlockProps) => {
  return (
    <div
      className={twMerge(
        'grid w-full grid-cols-1 rounded-lg border border-solid border-gray-200 p-4 shadow md:grid-cols-2 md:p-8',
        className
      )}
    >
      <div className="md:order-0 order-1 mx-auto w-full text-center md:my-auto md:px-6">
        <Zoom>
          <Image
            img={imgSrc}
            className={twMerge('max-h-60 p-1 shadow', imgClassName)}
          />
        </Zoom>
      </div>
      <div className="order-0 relative w-full md:order-1">
        <div className="mb-2 text-lg font-bold sm:text-xl">{title}</div>
        <div className="mb-4">{text}</div>
        {link && linkText && (
          <a href={link} className="hidden md:block">
            <ArrowRightIcon className="h-5 align-text-bottom" /> {linkText}
          </a>
        )}
      </div>
      {link && linkText && (
        <a href={link} className="order-2 mt-2 block md:hidden">
          <ArrowRightIcon className="h-5 align-text-bottom" /> {linkText}
        </a>
      )}
    </div>
  )
}

export default ImageTextBlock
