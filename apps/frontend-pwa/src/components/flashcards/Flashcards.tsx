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

  return (
    <div
      className={twMerge(
        'flex-1 md:max-w-xl md:mx-auto md:mb-4 md:p-8 md:pt-6 w-full'
      )}
    >
      <div
        className="relative flex items-center justify-center min-h-[300px] border border-gray-300 rounded shadow-lg cursor-pointer"
        style={{
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: 'transform 0.6s',
        }}
        onClick={handleFlip}
      >
        <FlashcardFront content={content} />
        <FlashcardBack explanation={explanation} />
      </div>
    </div>
  )
}

const FlashcardFront = ({ content }: { content: string }) => (
  <div
    className="absolute flex items-center justify-center w-full h-full p-4"
    style={{ backfaceVisibility: 'hidden' }}
  >
    <div className="text-xl font-bold">{content}</div>
  </div>
)

const FlashcardBack = ({ explanation }: { explanation: string }) => (
  <div
    className="absolute flex flex-col items-center justify-center w-full h-full p-4"
    style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
  >
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
