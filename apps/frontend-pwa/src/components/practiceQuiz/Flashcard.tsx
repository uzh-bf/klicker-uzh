import DynamicMarkdown from '@components/learningElements/DynamicMarkdown'
import { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { faCheck, faCheckDouble, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

// TODO: internationalization of text

interface FlashcardProps {
  content: string
  explanation: string
  response?: 'no' | 'partial' | 'yes'
  setResponse: (value: 'no' | 'partial' | 'yes') => void
}

function Flashcard({
  content,
  explanation,
  response,
  setResponse,
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
        className={`relative flex flex-col items-center justify-between min-h-[300px] border border-gray-300 rounded-lg shadow-lg cursor-pointer transform-style-preserve-3d transition-transform-0_6s ${
          isFlipped ? 'transform-rotateY-180' : ''
        }`}
        onClick={handleFlip}
      >
        {isFlipped ? (
          <FlashcardBack
            explanation={explanation}
            response={response}
            setResponse={setResponse}
          />
        ) : (
          <FlashcardFront content={content} />
        )}
      </div>
    </div>
  )
}

const FlashcardFront = ({ content }: { content: string }) => (
  <div className="flex m-auto items-center self-center justify-center w-full h-full p-4 backface-hidden">
    <DynamicMarkdown content={content} />
  </div>
)

interface FlashcardBackProps {
  explanation: string
  response?: 'no' | 'partial' | 'yes'
  setResponse: (value: 'no' | 'partial' | 'yes') => void
}

const FlashcardBack = ({
  explanation,
  response,
  setResponse,
}: FlashcardBackProps) => {
  const t = useTranslations()

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 transform-rotateY-180 backface-hidden">
      <div className="flex items-center justify-center flex-1 mb-4">
        <DynamicMarkdown content={explanation} />
      </div>
      <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0 w-full pt-8 mt-4 border-t border-gray-300">
        <p className="font-bold">
          {t('pwa.practiceQuiz.studentFlashcardResponse')}
        </p>
        <div className="flex flex-row justify-evenly w-full mt-2 space-x-2">
          <FlashcardButton
            active={response === 'no'}
            setResponse={() => setResponse('no')}
            text={t('pwa.practiceQuiz.flashcardNoResponse')}
            color="bg-red-300"
            activeColor="bg-red-600"
            icon={faX}
          />
          <FlashcardButton
            active={response === 'partial'}
            setResponse={() => setResponse('partial')}
            text={t('pwa.practiceQuiz.flashcardPartialResponse')}
            color="bg-orange-300"
            activeColor="bg-orange-600"
            icon={faCheck}
          />
          <FlashcardButton
            active={response === 'yes'}
            setResponse={() => setResponse('yes')}
            text={t('pwa.practiceQuiz.flashcardYesResponse')}
            color="bg-green-300"
            activeColor="bg-green-600"
            icon={faCheckDouble}
          />
        </div>
      </div>
    </div>
  )
}

interface FlashcardButtonProps {
  active: boolean
  setResponse: () => void
  text: string
  color: string
  activeColor: string
  icon: IconDefinition
}

const FlashcardButton = ({
  active,
  setResponse,
  text,
  color,
  activeColor,
  icon,
}: FlashcardButtonProps) => {
  return (
    <Button
      basic
      className={{
        root: twMerge(
          'w-full justify-center rounded p-0.5',
          active ? `text-white ${activeColor}` : color
        ),
      }}
      active={active}
      onClick={(e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e?.stopPropagation()
        setResponse()
      }}
    >
      <FontAwesomeIcon icon={icon} />
      {text}
    </Button>
  )
}

export default Flashcard
