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
        'grid grid-cols-1 md:grid-cols-2 p-4 md:p-8 border border-solid border-gray-200 rounded-lg shadow w-full',
        className
      )}
    >
      <div className="order-1 w-full mx-auto text-center md:px-6 md:my-auto md:order-0">
        <Zoom overlayBgColorEnd="gray">
          <Image
            img={imgSrc}
            className={twMerge('p-1 shadow max-h-60', imgClassName)}
          />
        </Zoom>
      </div>
      <div className="relative w-full order-0 md:order-1">
        <div className="mb-2 text-lg font-bold sm:text-xl">{title}</div>
        <div className="mb-4">{text}</div>
        {link && linkText && (
          <a href={link} className="hidden md:block">
            <ArrowRightIcon className="h-5 align-text-bottom" /> {linkText}
          </a>
        )}
      </div>
      {link && linkText && (
        <a href={link} className="order-2 block mt-2 md:hidden">
          <ArrowRightIcon className="h-5 align-text-bottom" /> {linkText}
        </a>
      )}
    </div>
  )
}

export default ImageTextBlock
