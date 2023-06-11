import { FlashcardSet } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'
import StatusTag from './StatusTag'

interface FlashcardStackProps {
  flashcardSet: FlashcardSet
}

function FlashcardStack({ flashcardSet }: FlashcardStackProps) {
  const stylestring =
    'absolute h-48 bg-white rounded-lg w-72 border border-solid border-uzh-grey-40 shadow p-2'

  // TODO: move to translations once internationalization is implemented
  const statusMap = {
    DRAFT: 'Draft',
    PUBLISHED: 'Published',
  }

  return (
    <div>
      <div className="relative h-48 w-72">
        <div className={twMerge(stylestring, 'z-0  -rotate-6')} />
        <div className={twMerge(stylestring, 'z-5  -rotate-3')} />
        <div className={twMerge(stylestring, 'z-10')}>
          <H3>{flashcardSet.name}</H3>
          <div className="italic">
            {flashcardSet.numOfFlashcards} Flashcards
          </div>
          <StatusTag
            status={statusMap[flashcardSet.status]}
            type={flashcardSet.status}
          />
          PUBLISH / EDIT / DELETE
        </div>
      </div>
    </div>
  )
}

export default FlashcardStack
