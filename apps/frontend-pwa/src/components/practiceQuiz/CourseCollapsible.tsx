import LinkButton from '@components/common/LinkButton'
import {
  faBookOpenReader,
  faChevronDown,
  faChevronUp,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LearningElement, PracticeQuiz } from '@klicker-uzh/graphql/dist/ops'
import * as RadixCollapsible from '@radix-ui/react-collapsible'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { resetPracticeQuizLocalStorage } from './PracticeQuiz'

export enum RepetitionElementType {
  LEARNING_ELEMENT,
  PRACTICE_QUIZ,
}

interface CourseCollapsibleProps {
  courseName: string
  elements: [LearningElement | PracticeQuiz, RepetitionElementType][]
}

function CourseCollapsible({ courseName, elements }: CourseCollapsibleProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(true)

  return (
    <div>
      <RadixCollapsible.Root
        open={open}
        onOpenChange={() => setOpen((prev) => !prev)}
      >
        <RadixCollapsible.Trigger
          className={twMerge(
            'flex flex-row justify-between text-lg font-bold text-slate-700 border-b-2 w-full items-center',
            open && 'mb-2'
          )}
        >
          <div>{courseName}</div>
          <FontAwesomeIcon
            icon={open ? faChevronUp : faChevronDown}
            size="sm"
          />
        </RadixCollapsible.Trigger>
        <RadixCollapsible.Content>
          <div className="flex flex-col gap-2">
            {elements.map(([element, elementType]) => (
              <LinkButton
                key={element.id}
                icon={faBookOpenReader}
                href={
                  elementType === RepetitionElementType.LEARNING_ELEMENT
                    ? `/course/${element.course!.id}/element/${element.id}`
                    : `/course/${element.course!.id}/quiz/${element.id}`
                }
                data={{ cy: 'practice-quiz' }}
                onClick={() => {
                  resetPracticeQuizLocalStorage(element.id)
                }}
              >
                {element.displayName}
              </LinkButton>
            ))}
          </div>
        </RadixCollapsible.Content>
      </RadixCollapsible.Root>
    </div>
  )
}

export default CourseCollapsible
