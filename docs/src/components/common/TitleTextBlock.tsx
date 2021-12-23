import clsx from 'clsx'
import React from 'react'
import { ArrowRightIcon } from '@heroicons/react/solid'

interface TitleTextBlockProps {
  title: string
  text: any
  link?: string
  linkText?: string
  className?: string
}
const TitleTextBlock = ({
  title,
  text,
  link,
  linkText,
  className,
}: TitleTextBlockProps) => {
  return (
    <div
      className={clsx(
        className,
        'relative py-4 px-6 border border-solid border-gray-300 rounded-lg shadow'
      )}
    >
      <div className="mb-2 text-lg font-bold sm:text-xl">{title}</div>
      <div className="mb-10">{text}</div>
      {link && linkText && (
        <a href={link} className="absolute bottom-4">
          <ArrowRightIcon className="h-5 align-text-bottom" /> {linkText}
        </a>
      )}
    </div>
  )
}

export default TitleTextBlock
