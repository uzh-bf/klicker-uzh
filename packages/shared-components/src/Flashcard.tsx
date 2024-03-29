import {
  IconDefinition,
  faHandPointer,
} from '@fortawesome/free-regular-svg-icons'
import { faCheck, faCheckDouble, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FlashcardCorrectnessType } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import DynamicMarkdown from './evaluation/DynamicMarkdown'

interface FlashcardProps {
  content: string
  explanation: string
  response?: FlashcardCorrectnessType
  setResponse: (value: FlashcardCorrectnessType) => void
  existingResponse?: FlashcardCorrectnessType
  elementIx: number
}

function Flashcard({
  content,
  explanation,
  response,
  setResponse,
  existingResponse,
  elementIx,
}: FlashcardProps) {
  const t = useTranslations()
  const [isFlipped, setIsFlipped] = useState(
    typeof existingResponse !== 'undefined' ?? false
  )

  const handleFlip = () => {
    setIsFlipped((prev) => !prev)
  }

  return (
    <div>
      <div className={twMerge('flex-1 md:max-w-xl md:mx-auto md:mb-4 w-full')}>
        <div
          className={`flex flex-col p-4 border border-gray-300 rounded-lg shadow transform-style-preserve-3d transition-transform-0_6s ${
            isFlipped
              ? 'transform-rotateY-180'
              : 'cursor-pointer hover:shadow-xl'
          }`}
          onClick={!isFlipped ? handleFlip : () => null}
        >
          <FlashcardFront
            isFlipped={isFlipped}
            content={content}
            elementIx={elementIx}
          />

          {isFlipped ? (
            <FlashcardBack
              explanation={explanation}
              response={response}
              setResponse={setResponse}
              existingResponse={existingResponse}
              elementIx={elementIx}
            />
          ) : (
            <div className="flex flex-row items-center self-end gap-2 text-sm text-gray-500">
              <FontAwesomeIcon icon={faHandPointer} />
              {t('pwa.practiceQuiz.flashcardClick')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FlashcardFront({
  isFlipped,
  content,
  elementIx,
}: {
  isFlipped: boolean
  content: string
  elementIx: number
}) {
  return (
    <DynamicMarkdown
      withProse
      data={{ cy: `flashcard-front-${elementIx + 1}` }}
      content={content}
      className={{
        root: twMerge(
          'mx-auto text-center flex-none',
          isFlipped &&
            'w-full transform-rotateY-180 px-4 py-2 border rounded bg-slate-100 prose-p:mb-0 mb-4 backface-hidden'
        ),
      }}
    />
  )
}

interface FlashcardBackProps {
  explanation: string
  response?: FlashcardCorrectnessType
  setResponse: (value: FlashcardCorrectnessType) => void
  existingResponse?: FlashcardCorrectnessType
  elementIx: number
}

function FlashcardBack({
  explanation,
  response,
  setResponse,
  existingResponse,
  elementIx,
}: FlashcardBackProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col flex-1 w-full transform-rotateY-180">
      <div className="flex flex-1">
        <DynamicMarkdown content={explanation} withProse />
      </div>
      <div className="flex flex-col items-center justify-center flex-shrink-0 w-full gap-1 pt-4 border-t border-gray-300">
        <p className="font-bold">
          {t('pwa.practiceQuiz.studentFlashcardResponse')}
        </p>
        <div className="flex flex-row w-full mt-2 space-x-2 justify-evenly">
          <FlashcardButton
            active={
              response === FlashcardCorrectnessType.Incorrect ||
              existingResponse === FlashcardCorrectnessType.Incorrect
            }
            setResponse={() => setResponse(FlashcardCorrectnessType.Incorrect)}
            text={t('pwa.practiceQuiz.flashcardNoResponse')}
            color="bg-red-300"
            activeColor="bg-red-600"
            icon={faX}
            disabled={typeof existingResponse !== 'undefined'}
            elementIx={elementIx}
          />
          <FlashcardButton
            active={
              response === FlashcardCorrectnessType.Partial ||
              existingResponse === FlashcardCorrectnessType.Partial
            }
            setResponse={() => setResponse(FlashcardCorrectnessType.Partial)}
            text={t('pwa.practiceQuiz.flashcardPartialResponse')}
            color="bg-orange-300"
            activeColor="bg-orange-600"
            icon={faCheck}
            disabled={typeof existingResponse !== 'undefined'}
            elementIx={elementIx}
          />
          <FlashcardButton
            active={
              response === FlashcardCorrectnessType.Correct ||
              existingResponse === FlashcardCorrectnessType.Correct
            }
            setResponse={() => setResponse(FlashcardCorrectnessType.Correct)}
            text={t('pwa.practiceQuiz.flashcardYesResponse')}
            color="bg-green-300"
            activeColor="bg-green-600"
            icon={faCheckDouble}
            disabled={typeof existingResponse !== 'undefined'}
            elementIx={elementIx}
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
  disabled?: boolean
  elementIx: number
}

function FlashcardButton({
  active,
  setResponse,
  text,
  color,
  activeColor,
  icon,
  disabled,
  elementIx,
}: FlashcardButtonProps) {
  return (
    <Button
      basic
      disabled={disabled}
      className={{
        root: twMerge(
          'w-full justify-center rounded px-3 py-2 hover:shadow hover:brightness-95',
          disabled &&
            'opacity-70 cursor-not-allowed hover:brightness-100 hover:shadow-none',
          active ? `text-white opacity-100 ${activeColor}` : color
        ),
      }}
      active={active}
      onClick={(e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e?.stopPropagation()
        setResponse()
      }}
      data={{ cy: `flashcard-response-${elementIx + 1}-${text}` }}
    >
      <FontAwesomeIcon icon={icon} />
      {text}
    </Button>
  )
}

export default Flashcard
