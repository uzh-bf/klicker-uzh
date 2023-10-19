import DynamicMarkdown from '@components/learningElements/DynamicMarkdown'
import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

// TODO: internationalization of text

interface FlashcardProps {
  content: string
  explanation: string
  difficulty: string
  setDifficulty: (difficulty: string) => void
}

function Flashcard({
  content,
  explanation,
  difficulty,
  setDifficulty,
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  const handleFlip = () => {
    setIsFlipped((prev) => !prev)
  }

  return (
    <div
      className={twMerge(
        'flex-1 md:max-w-xl md:mx-auto md:mb-4 md:p-8 md:pt-6 w-full'
      )}
    >
      <div
        className={`relative flex flex-col items-center justify-between min-h-[300px] border border-gray-300 rounded shadow-lg cursor-pointer transform-style-preserve-3d transition-transform-0_6s ${
          isFlipped ? 'transform-rotateY-180' : ''
        }`}
        onClick={handleFlip}
      >
        {isFlipped ? (
          <FlashcardBack
            explanation={explanation}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
          />
        ) : (
          <FlashcardFront content={content} />
        )}
      </div>
    </div>
  )
}

const FlashcardFront = ({ content }: { content: string }) => (
  <div className="flex items-center self-center justify-center w-full h-full p-4 backface-hidden">
    <DynamicMarkdown content={content} />
  </div>
)

interface FlashcardBackProps {
  explanation: string
  difficulty: string
  setDifficulty: (difficulty: string) => void
}

const FlashcardBack = ({
  explanation,
  difficulty,
  setDifficulty,
}: FlashcardBackProps) => (
  <div className="flex flex-col items-center justify-center w-full h-full p-4 transform-rotateY-180 backface-hidden">
    <div className="flex items-center justify-center flex-1 mb-4">
      <DynamicMarkdown content={explanation} />
    </div>
    <div className="flex flex-col items-center justify-center flex-shrink-0 w-full pt-8 mt-4 border-t border-gray-300">
      <p className="mb-2 text-sm font-bold">How difficult was the question?</p>
      <div className="flex flex-row mt-2 space-x-2">
        <Button
          active={difficulty === 'hard'}
          onClick={(e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            e?.stopPropagation()
            setDifficulty('hard')
          }}
        >
          Hard
        </Button>
        <Button
          active={difficulty === 'okay'}
          onClick={(e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            e?.stopPropagation()
            setDifficulty('okay')
          }}
        >
          Okay
        </Button>
        <Button
          active={difficulty === 'easy'}
          onClick={(e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            e?.stopPropagation()
            setDifficulty('easy')
          }}
        >
          Easy
        </Button>
      </div>
    </div>
  </div>
)

export default Flashcard
