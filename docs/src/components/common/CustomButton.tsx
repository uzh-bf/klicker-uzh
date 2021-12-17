import clsx from 'clsx'
import React from 'react'

interface CustomButtonProps {
  text: any
  link: string
  className?: string
}

const CustomButton = ({ text, link, className }: CustomButtonProps) => {
  return (
    <a href={link} className="cursor-default">
      <div
        className={clsx(
          className,
          'rounded-md m-2 text-center border-2 border-solid hover:shadow md:hover:shadow-lg border-gray-300 cursor-pointer'
        )}
      >
        <div className="my-2">{text}</div>
      </div>
    </a>
  )
}

export default CustomButton
