import clsx from 'clsx'
import React from 'react'

interface CustomButtonProps {
  text: string
  link: string
  className?: string
}

const CustomButton = ({ text, link, className }: CustomButtonProps) => {
  return (
    <a href={link} className="cursor-default">
      <div
        className={clsx(
          className,
          'rounded-md m-2 text-center border-2 border-solid hover:shaded-sm hover:shadow border-gray-300 cursor-pointer'
        )}
      >
        <div className="my-2">{text}</div>
      </div>
    </a>
  )
}

export default CustomButton
