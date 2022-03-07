import React from 'react'
import { Button } from '@klicker-uzh/ui'

interface CustomButtonProps {
  text: any
  link: string
  className?: string
}

const CustomButton = ({ text, link, className }: CustomButtonProps) => {
  return <Button text={text} link={link} className={className} />
}

export default CustomButton
