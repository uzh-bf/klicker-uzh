import { FlashcardSet } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import { twMerge } from 'tailwind-merge'

interface FlashcardStackProps {
  flashcardSet: FlashcardSet
}

function FlashcardStack({ flashcardSet }: FlashcardStackProps) {
  const stylestring =
    'absolute h-48 bg-white rounded-lg w-72 border border-solid border-uzh-grey-40 shadow p-2'

  return (
    <div>
      <div className="relative h-48 w-72">
        <div className={twMerge(stylestring, 'z-0  -rotate-6')} />
        <div className={twMerge(stylestring, 'z-5  -rotate-3')} />
        <div className={twMerge(stylestring, 'z-10')}>
          <H3>{flashcardSet.name}</H3>
          CONTENT... DRAFT / PUBLISHED / EDIT / DELETE
        </div>
      </div>
    </div>
  )
}

export default FlashcardStack
