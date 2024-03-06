import { faBookOpen, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import DynamicMarkdown from './evaluation/DynamicMarkdown'

interface ContentelementProps {
  element: ElementInstance
  read: boolean
  onRead: () => void
  elementIx: number
  hideReadButton?: boolean
}

function ContentElement({
  element,
  read,
  onRead,
  elementIx,
  hideReadButton = false,
}: ContentelementProps) {
  const t = useTranslations()

  return (
    <div
      className={twMerge(
        'px-3 pt-2 border border-solid rounded-lg bg-slate-100',
        !hideReadButton && 'pb-10'
      )}
      data-cy={`content-element-${elementIx + 1}`}
    >
      <div className="flex flex-row gap-3 -mb-2">
        <FontAwesomeIcon icon={faBookOpen} className="mt-1.5" />
        <DynamicMarkdown
          content={element.elementData.content}
          withProse
          data={{ cy: `content-element-md-${elementIx + 1}` }}
        />
      </div>
      {!hideReadButton && (
        <Button
          disabled={read}
          onClick={onRead}
          className={{
            root: twMerge(
              'float-right h-8',
              read && 'bg-green-700 bg-opacity-50 text-white'
            ),
          }}
          data={{ cy: `read-content-element-${elementIx + 1}` }}
        >
          <FontAwesomeIcon icon={faCheck} />
          <div>{t('pwa.practiceQuiz.read')}</div>
        </Button>
      )}
    </div>
  )
}

export default ContentElement
