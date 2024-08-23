import {
  faBookOpenReader,
  faChevronDown,
  faChevronUp,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import * as RadixCollapsible from '@radix-ui/react-collapsible'
import { useLocalStorage } from '@uidotdev/usehooks'
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
      <RadixCollapsible.Root
        open={open}
        onOpenChange={() => {
          setOpen((prev) => !prev)
          setStackStorage((prev) => !prev)
        }}
      >
        <RadixCollapsible.Trigger
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
        </RadixCollapsible.Trigger>
        <RadixCollapsible.Content>
          <div className="flex flex-col gap-2">
            {elements.map((element) => (
              <LinkButton
                key={element.id}
                icon={faBookOpenReader}
                href={`/course/${courseId}/quiz/${element.id}`}
                data={{ cy: `practice-quiz-${element.displayName}` }}
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
