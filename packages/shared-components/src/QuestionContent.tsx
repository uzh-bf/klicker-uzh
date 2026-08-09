import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Markdown } from '@klicker-uzh/markdown'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'

function QuestionContent({
  content,
  noPoints,
}: {
  content: string
  noPoints: boolean
}) {
  const t = useTranslations()

  if (content === '<br>') {
    return null
  }

  return (
    <div
      className={twMerge(
        'prose prose-p:m-0! prose-img:m-0! relative mb-4 min-h-24 max-w-none flex-initial rounded border p-4 leading-6',
        noPoints && 'mt-4 rounded-tr-none'
      )}
    >
      {noPoints ? (
        <div className="bg-primary-100 absolute -top-5 right-0 flex flex-row items-center gap-1.5 rounded-t-lg px-1.5 text-sm text-white">
          <FontAwesomeIcon icon={faInfoCircle} />
          {t('shared.generic.noPoints')}
        </div>
      ) : null}
      <Markdown content={content} data={{ cy: `instance-question-content` }} />
    </div>
  )
}

export default QuestionContent
