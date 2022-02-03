import React from 'react'
import { twMerge } from 'tailwind-merge'

export interface ButtonProps {
  text: any
  link: string
  className?: string
}

export function Button({ text, link, className }: ButtonProps) {
  return (
    <a href={link} className="cursor-default">
      <div
        className={twMerge(
          'rounded-md text-center border-2 border-solid hover:shadow md:hover:shadow-lg border-gray-300 cursor-pointer',
          className
        )}
      >
        <div className="my-2">{text}</div>
      </div>
    </a>
  )
}
