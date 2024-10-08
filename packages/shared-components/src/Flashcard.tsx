import type { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { faHandPointer } from '@fortawesome/free-regular-svg-icons'
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
      <div className={twMerge('w-full flex-1 md:mx-auto md:mb-4 md:max-w-xl')}>
        <div
          className={`transform-style-preserve-3d transition-transform-0_6s flex flex-col rounded-lg border border-gray-300 p-4 shadow ${
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
            <div className="mt-2 flex flex-row items-center gap-2 self-end text-sm text-gray-500">
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
          'prose prose-p:!m-0 prose-img:!m-0 mx-auto flex-none text-center',
          isFlipped &&
            'transform-rotateY-180 backface-hidden prose-p:mb-0 mb-4 w-full rounded border bg-slate-100 px-4 py-2'
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
    <div className="transform-rotateY-180 flex w-full flex-1 flex-col">
      <div className="prose prose-p:!m-0 prose-img:!m-0 flex flex-1">
        <DynamicMarkdown content={explanation} withProse />
      </div>
      <div className="flex w-full flex-shrink-0 flex-col items-center justify-center gap-1 border-t border-gray-300 pt-4">
        <p className="font-bold">
          {t('pwa.practiceQuiz.studentFlashcardResponse')}
        </p>
        <div className="mt-2 flex w-full flex-row justify-evenly space-x-2">
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
            'cursor-not-allowed opacity-70 hover:shadow-none hover:brightness-100',
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
