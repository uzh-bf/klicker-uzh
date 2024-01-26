import { faBookOpen, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import DynamicMarkdown from 'src/components/learningElements/DynamicMarkdown'
import { twMerge } from 'tailwind-merge'

interface ContentelementProps {
  element: ElementInstance
  read: boolean
  onRead: () => void
}

function ContentElement({ element, read, onRead }: ContentelementProps) {
  const t = useTranslations()

  return (
    <div className="px-3 py-2 border border-solid rounded-lg bg-slate-100">
      <div className="flex flex-row gap-3 -mb-2">
        <FontAwesomeIcon icon={faBookOpen} className="mt-1.5" />
        <DynamicMarkdown content={element.elementData.content} withProse />
      </div>
      <Button
        disabled={read}
        onClick={onRead}
        className={{
          root: twMerge(
            'float-right h-8',
            read && 'bg-green-700 bg-opacity-50 text-white'
          ),
        }}
      >
        <FontAwesomeIcon icon={faCheck} />
        <div>{t('pwa.practiceQuiz.read')}</div>
      </Button>
    </div>
  )
}

export default ContentElement
