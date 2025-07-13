import { faCircleXmark } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faComment,
  faEye,
  faEyeSlash,
  faThumbTack,
  faThumbTackSlash,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import TagHeader from '../../questions/tags/TagHeader'
import TagItem from '../../questions/tags/TagItem'

export interface FeedbackOverviewFilterProps {
  showResolved: boolean
  showOpen: boolean
  showPinned: boolean
  showUnpinned: boolean
  showPublished: boolean
  showUnpublished: boolean
  setShowResolved: Dispatch<SetStateAction<boolean>>
  setShowOpen: Dispatch<SetStateAction<boolean>>
  setShowPinned: Dispatch<SetStateAction<boolean>>
  setShowUnpinned: Dispatch<SetStateAction<boolean>>
  setShowPublished: Dispatch<SetStateAction<boolean>>
  setShowUnpublished: Dispatch<SetStateAction<boolean>>
  handleReset: () => void
}

function FeedbackOverviewFilters({
  showResolved,
  showOpen,
  showPinned,
  showUnpinned,
  showPublished,
  showUnpublished,
  setShowResolved,
  setShowOpen,
  setShowPinned,
  setShowUnpinned,
  setShowPublished,
  setShowUnpublished,
  handleReset,
}: FeedbackOverviewFilterProps) {
  const t = useTranslations()
  const [statusVisible, setStatusVisible] = useState(true)
  const [visibilityVisible, setVisibilityVisible] = useState(true)
  const [pinningVisible, setPinningVisible] = useState(true)

  const resetDisabled = useMemo(
    () =>
      showResolved === true &&
      showOpen === true &&
      !showPinned &&
      !showUnpinned &&
      !showPublished &&
      !showUnpublished,
    [
      showResolved,
      showOpen,
      showPinned,
      showUnpinned,
      showPublished,
      showUnpublished,
    ]
  )

  const toggleResolvedFilter = () => {
    setShowResolved(!showResolved)
  }

  const toggleOpenFilter = () => {
    setShowOpen(!showOpen)
  }

  const togglePinnedFilter = () => {
    if (showPinned) {
      setShowPinned(false)
    } else {
      setShowPinned(true)
      setShowUnpinned(false)
    }
  }

  const toggleUnpinnedFilter = () => {
    if (showUnpinned) {
      setShowUnpinned(false)
    } else {
      setShowUnpinned(true)
      setShowPinned(false)
    }
  }

  const togglePublishedFilter = () => {
    if (showPublished) {
      setShowPublished(false)
    } else {
      setShowPublished(true)
      setShowUnpublished(false)
    }
  }

  const toggleUnpublishedFilter = () => {
    if (showUnpublished) {
      setShowUnpublished(false)
    } else {
      setShowUnpublished(true)
      setShowPublished(false)
    }
  }

  return (
    <div className="flex h-max max-h-full flex-1 flex-col overflow-y-auto rounded-md border border-solid p-2 text-sm md:w-56">
      <TagHeader
        text={t('shared.generic.status')}
        state={statusVisible}
        setState={setStatusVisible}
      />
      {statusVisible && (
        <ul className="list-none">
          <TagItem
            text={t('manage.cockpit.filterSolved')}
            icon={[faCheck, faCheck]}
            active={showResolved}
            onClick={toggleResolvedFilter}
            data={{ cy: 'feedback-filter-resolved' }}
          />
          <TagItem
            text={t('manage.cockpit.filterOpen')}
            icon={[faComment, faComment]}
            active={showOpen}
            onClick={toggleOpenFilter}
            data={{ cy: 'feedback-filter-open' }}
          />
        </ul>
      )}

      <TagHeader
        text={t('manage.cockpit.pinning')}
        state={pinningVisible}
        setState={setPinningVisible}
      />
      {pinningVisible && (
        <ul className="list-none">
          <TagItem
            text={t('manage.cockpit.filterPinned')}
            icon={[faThumbTack, faThumbTack]}
            active={showPinned}
            onClick={togglePinnedFilter}
            data={{ cy: 'feedback-filter-pinned' }}
          />
          <TagItem
            text={t('manage.cockpit.filterUnpinned')}
            icon={[faThumbTackSlash, faThumbTackSlash]}
            active={showUnpinned}
            onClick={toggleUnpinnedFilter}
            data={{ cy: 'feedback-filter-unpinned' }}
          />
        </ul>
      )}

      <TagHeader
        text={t('manage.cockpit.visibility')}
        state={visibilityVisible}
        setState={setVisibilityVisible}
      />
      {visibilityVisible && (
        <ul className="list-none">
          <TagItem
            text={t('manage.cockpit.filterPublished')}
            icon={[faEye, faEye]}
            active={showPublished}
            onClick={togglePublishedFilter}
            data={{ cy: 'feedback-filter-published' }}
          />
          <TagItem
            text={t('manage.cockpit.filterUnpublished')}
            icon={[faEyeSlash, faEyeSlash]}
            active={showUnpublished}
            onClick={toggleUnpublishedFilter}
            data={{ cy: 'feedback-filter-unpublished' }}
          />
        </ul>
      )}

      <Button
        className={{
          root: twMerge('mt-4 h-8 text-sm', !resetDisabled && 'border-red-600'),
        }}
        disabled={resetDisabled}
        onClick={handleReset}
        data={{ cy: 'reset-feedback-filters' }}
      >
        <Button.Icon className={{ root: 'mr-1' }} icon={faCircleXmark} />
        <Button.Label>{t('manage.questionPool.resetFilters')}</Button.Label>
      </Button>
    </div>
  )
}

export default FeedbackOverviewFilters
