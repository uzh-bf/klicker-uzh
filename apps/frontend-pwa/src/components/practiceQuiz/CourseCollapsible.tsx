import {
  faBookOpenReader,
  faChevronDown,
  faChevronUp,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useLocalStorage } from '@uidotdev/usehooks'
import {
  ShadcnCollapsible,
  ShadcnCollapsibleContent,
  ShadcnCollapsibleTrigger,
} from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import LinkButton from '../common/LinkButton'
import { resetPracticeQuizLocalStorage } from './PracticeQuiz'

interface CourseCollapsibleProps {
  courseId: string
  courseName: string
  elements: { id: string; displayName: string }[]
}

function CourseCollapsible({
  courseId,
  courseName,
  elements,
}: CourseCollapsibleProps) {
  const [stackStorage, setStackStorage] = useLocalStorage<boolean>(
    `replist-collapse-${courseId}`,
    true
  )
  const [open, setOpen] = useState(stackStorage || false)

  return (
    <div>
      <ShadcnCollapsible
        open={open}
        onOpenChange={() => {
          setOpen((prev) => !prev)
          setStackStorage((prev) => !prev)
        }}
      >
        <ShadcnCollapsibleTrigger
          className={twMerge(
            'flex w-full flex-row items-center justify-between border-b-2 text-lg font-bold text-slate-700',
            open && 'mb-2'
          )}
        >
          <div>{courseName}</div>
          <FontAwesomeIcon
            icon={open ? faChevronUp : faChevronDown}
            size="sm"
          />
        </ShadcnCollapsibleTrigger>
        <ShadcnCollapsibleContent>
          <div className="flex flex-col gap-2">
            {elements.map((element) => (
              <LinkButton
                key={element.id}
                icon={faBookOpenReader}
                href={`/course/${courseId}/practiceQuizzes/${element.id}`}
                data={{ cy: `practice-quiz-${element.displayName}` }}
                onClick={() => {
                  resetPracticeQuizLocalStorage(element.id)
                }}
              >
                {element.displayName}
              </LinkButton>
            ))}
          </div>
        </ShadcnCollapsibleContent>
      </ShadcnCollapsible>
    </div>
  )
}

export default CourseCollapsible
