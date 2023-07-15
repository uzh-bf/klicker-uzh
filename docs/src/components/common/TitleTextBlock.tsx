import { ArrowRightIcon } from '@heroicons/react/solid'
import { twMerge } from 'tailwind-merge'

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
      className={twMerge(
        className,
        'relative rounded-lg border border-solid border-gray-200 p-4 shadow md:p-8'
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
