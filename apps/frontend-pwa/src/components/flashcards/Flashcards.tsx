import { Button } from '@uzh-bf/design-system'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface FlashcardProps {
  content: string
  explanation: string
}

function Flashcard({ content, explanation }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }
  const contentt =
    'This is the content. It is a bit longer, so it should still fit as the box is intended to grow'
  return (
    <div
      className={twMerge(
        'flex-1 md:max-w-xl md:mx-auto md:mb-4 md:p-8 md:pt-6 w-full'
      )}
    >
      <div
        className="flex items-center justify-center border border-gray-300 rounded shadow-lg min-h-[300px] transition-transform transform cursor-pointer w-full p-4"
        onClick={handleFlip}
      >
        {isFlipped ? (
          <FlashcardBack explanation={explanation} />
        ) : (
          <FlashcardFront content={contentt} />
        )}
      </div>
    </div>
  )
}

const FlashcardFront = ({ content }: { content: string }) => (
  <div className="flex items-center justify-center w-full h-full p-4">
    <div className="text-xl font-bold">{content}</div>
  </div>
)

const FlashcardBack = ({ explanation }: { explanation: string }) => (
  <div className="flex flex-col w-full h-full p-4">
    <div className="flex items-center justify-center flex-1 mb-4">
      <div className="text-lg font-semibold">{explanation}</div>
    </div>
    <div className="flex flex-col items-center justify-center flex-shrink-0 w-full pt-8 mt-4 border-t border-gray-300">
      <p className="mb-2 text-sm font-bold">How difficult was the question?</p>
      <div className="flex flex-row mt-2 space-x-2">
        <Button
          onClick={(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            e.stopPropagation()
            console.log('Hard question')
          }}
        >
          Hard
        </Button>
        <Button
          onClick={(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            e.stopPropagation()
            console.log('Okay question')
          }}
        >
          Okay
        </Button>
        <Button
          onClick={(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
            e.stopPropagation()
            console.log('Easy question')
          }}
        >
          Easy
        </Button>
      </div>
    </div>
  </div>
)

export default Flashcard
