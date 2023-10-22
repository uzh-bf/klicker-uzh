import DynamicMarkdown from '@components/learningElements/DynamicMarkdown'
import {
  IconDefinition,
  faHandPointer,
} from '@fortawesome/free-regular-svg-icons'
import { faCheck, faCheckDouble, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

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
  const t = useTranslations()
  const [isFlipped, setIsFlipped] = useState(false)

  const handleFlip = () => {
    setIsFlipped((prev) => !prev)
  }

  return (
    <div className={twMerge('flex-1 md:max-w-xl md:mx-auto md:mb-4 w-full')}>
      <div
        className={`flex flex-col p-4 border border-gray-300 rounded-lg shadow transform-style-preserve-3d transition-transform-0_6s ${
          isFlipped ? 'transform-rotateY-180' : 'cursor-pointer hover:shadow-xl'
        }`}
        onClick={!isFlipped ? handleFlip : () => null}
      >
        <FlashcardFront isFlipped={isFlipped} content={content} />

        {isFlipped ? (
          <FlashcardBack
            explanation={explanation}
            response={response}
            setResponse={setResponse}
          />
        ) : (
          <div className="self-end text-sm text-gray-500 flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faHandPointer} />
            {t('pwa.practiceQuiz.flashcardClick')}
          </div>
        )}
      </div>
    </div>
  )
}

function FlashcardFront({
  isFlipped,
  content,
}: {
  isFlipped: boolean
  content: string
}) {
  return (
    <DynamicMarkdown
      withProse
      content={content}
      className={{
        root: twMerge(
          'mx-auto text-center flex-none',
          isFlipped &&
            'w-full transform-rotateY-180 px-4 py-2 border rounded bg-slate-100 prose-p:mb-0 mb-4'
        ),
      }}
    />
  )
}

interface FlashcardBackProps {
  explanation: string
  response?: 'no' | 'partial' | 'yes'
  setResponse: (value: 'no' | 'partial' | 'yes') => void
}

function FlashcardBack({
  explanation,
  response,
  setResponse,
}: FlashcardBackProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col items-center justify-center w-full flex-1 transform-rotateY-180 backface-hidden">
      <div className="flex items-center justify-center flex-1">
        <DynamicMarkdown content={explanation} withProse />
      </div>
      <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0 w-full pt-4 border-t border-gray-300">
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

function FlashcardButton({
  active,
  setResponse,
  text,
  color,
  activeColor,
  icon,
}: FlashcardButtonProps) {
  return (
    <Button
      basic
      className={{
        root: twMerge(
          'w-full justify-center rounded px-3 py-2 hover:shadow hover:brightness-95',
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
