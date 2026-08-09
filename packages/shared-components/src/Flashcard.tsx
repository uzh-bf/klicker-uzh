import type { IconDefinition } from '@fortawesome/free-regular-svg-icons'
import { faHandPointer } from '@fortawesome/free-regular-svg-icons'
import { faCheck, faCheckDouble, faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FlashcardCorrectness } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import React, { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import DynamicMarkdown from './evaluation/DynamicMarkdown'

interface FlashcardProps {
  content: string
  explanation: string
  response?: FlashcardCorrectness
  setResponse: (value: FlashcardCorrectness) => void
  existingResponse?: FlashcardCorrectness
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
    typeof existingResponse !== 'undefined'
  )

  const handleFlip = () => {
    setIsFlipped((prev) => !prev)
  }

  useEffect(() => {
    if (typeof existingResponse !== 'undefined') {
      setIsFlipped(true)
    }
  }, [existingResponse])

  return (
    <div>
      <div className={twMerge('w-full flex-1 md:mx-auto md:mb-4 md:max-w-xl')}>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: The card renders arbitrary markdown and response controls when flipped, so a native button would be invalid. */}
        {/* biome-ignore lint/a11y/useSemanticElements: The card renders arbitrary markdown and response controls when flipped, so a native button would be invalid. */}
        <div
          role={!isFlipped ? 'button' : undefined}
          tabIndex={!isFlipped ? 0 : -1}
          className={twMerge(
            'transform-3d flex flex-col rounded-lg border border-gray-300 p-4 shadow [transition:transform_0.6s]',
            isFlipped ? 'rotate-y-180' : 'cursor-pointer hover:shadow-xl'
          )}
          onClick={!isFlipped ? handleFlip : undefined}
          onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
            if (!isFlipped && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault()
              handleFlip()
            }
          }}
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
      data={{ cy: `flashcard-front-${elementIx}` }}
      content={content}
      className={{
        root: twMerge(
          'prose prose-p:m-0! prose-img:m-0! mx-auto flex-none text-center',
          isFlipped &&
            'rotate-y-180 backface-hidden prose-p:mb-0 mb-4 w-full rounded border bg-slate-100 px-4 py-2'
        ),
      }}
    />
  )
}

interface FlashcardBackProps {
  explanation: string
  response?: FlashcardCorrectness
  setResponse: (value: FlashcardCorrectness) => void
  existingResponse?: FlashcardCorrectness
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
    <div className="rotate-y-180 flex w-full flex-1 flex-col">
      <div className="prose prose-p:m-0! prose-img:m-0! flex flex-1">
        <DynamicMarkdown content={explanation} withProse />
      </div>
      <div className="flex w-full shrink-0 flex-col items-center justify-center gap-1 border-t border-gray-300 pt-4">
        <p className="font-bold">
          {t('pwa.practiceQuiz.studentFlashcardResponse')}
        </p>
        <div className="mt-2 flex w-full flex-row justify-evenly gap-2">
          <FlashcardButton
            active={
              response === FlashcardCorrectness.Incorrect ||
              existingResponse === FlashcardCorrectness.Incorrect
            }
            setResponse={() => setResponse(FlashcardCorrectness.Incorrect)}
            text={t('pwa.practiceQuiz.flashcardNoResponse')}
            color="bg-red-300 hover:bg-red-300"
            activeColor="bg-red-600 hover:bg-red-600"
            icon={faX}
            disabled={typeof existingResponse !== 'undefined'}
            elementIx={elementIx}
          />
          <FlashcardButton
            active={
              response === FlashcardCorrectness.Partial ||
              existingResponse === FlashcardCorrectness.Partial
            }
            setResponse={() => setResponse(FlashcardCorrectness.Partial)}
            text={t('pwa.practiceQuiz.flashcardPartialResponse')}
            color="bg-orange-300 hover:bg-orange-300"
            activeColor="bg-orange-600 hover:bg-orange-600"
            icon={faCheck}
            disabled={typeof existingResponse !== 'undefined'}
            elementIx={elementIx}
          />
          <FlashcardButton
            active={
              response === FlashcardCorrectness.Correct ||
              existingResponse === FlashcardCorrectness.Correct
            }
            setResponse={() => setResponse(FlashcardCorrectness.Correct)}
            text={t('pwa.practiceQuiz.flashcardYesResponse')}
            color="bg-green-300 hover:bg-green-300"
            activeColor="bg-green-600 hover:bg-green-600"
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
      onClick={(e?: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e?.stopPropagation()
        setResponse()
      }}
      className={{
        root: twMerge(
          color,
          'flex-1 hover:bg-transparent hover:brightness-95',
          active
            ? `text-white opacity-100 hover:text-white ${activeColor}`
            : color
        ),
      }}
      data={{ cy: `flashcard-response-${elementIx}-${text}` }}
    >
      <Button.Icon icon={icon} />
      <Button.Label>{text}</Button.Label>
    </Button>
  )
}

export default Flashcard
