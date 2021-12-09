import clsx from 'clsx'
import React from 'react'

import CustomButton from './CustomButton'

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
    <div className={clsx(className, 'm-3')}>
      <div className="mb-2 text-xl font-bold">{title}</div>
      <div>{text}</div>
      {link && linkText && (
        <CustomButton text={linkText} className="w-40 mt-3 ml-0" link={link} />
      )}
    </div>
  )
}

export default TitleTextBlock
