import { faEye } from '@fortawesome/free-regular-svg-icons'
import { faList, faSync, faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'

interface CompletionStepProps {
  children?: React.ReactNode
  completionSuccessMessage?: (elementName: string) => React.ReactNode
  name: string
  editMode: boolean
  previewElementHref?: string
  viewElementHref: string
  onRestartForm: () => void
  resetForm: () => void
  setStepNumber: (stepNumber: number) => void
  onCloseWizard: () => void
}

function CompletionStep({
  children,
  completionSuccessMessage,
  name,
  editMode,
  previewElementHref,
  viewElementHref,
  onRestartForm,
  resetForm,
  setStepNumber,
  onCloseWizard,
}: CompletionStepProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div className="mx-auto flex flex-col items-center gap-4 p-4">
      <div>
        {completionSuccessMessage
          ? completionSuccessMessage(name)
          : editMode
            ? t('manage.activityWizard.changesSaved')
            : t('manage.activityWizard.elementCreated')}
      </div>
      <div className="space-x-2">
        {children}

        {previewElementHref && (
          <Link href={previewElementHref} target="_blank" prefetch>
            <Button
              data={{ cy: 'load-activity-preview' }}
              className={{ root: 'space-x-1' }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faEye} />
              </Button.Icon>
              <Button.Label>
                {t('manage.activityWizard.openPreview')}
              </Button.Label>
            </Button>
          </Link>
        )}

        <Link href={viewElementHref}>
          <Button
            data={{ cy: 'load-live-quiz-list' }}
            className={{ root: 'space-x-1' }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faList} />
            </Button.Icon>
            <Button.Label>
              {t('manage.activityWizard.openOverview')}
            </Button.Label>
          </Button>
        </Link>

        {editMode ? (
          <Button
            onClick={() => {
              onCloseWizard()
              router.push({ pathname: '/' }, undefined, { shallow: true })
            }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faXmark} />
            </Button.Icon>
            <Button.Label>
              {t('manage.activityWizard.closeWizard')}
            </Button.Label>
          </Button>
        ) : (
          <Button
            onClick={() => {
              onRestartForm()
              resetForm()
              setStepNumber(0)
              router.push({ pathname: '/' }, undefined, { shallow: true })
            }}
            className={{ root: 'space-x-1' }}
            data={{ cy: 'create-new-element' }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faSync} />
            </Button.Icon>
            <Button.Label>
              {t('manage.activityWizard.createNewElement')}
            </Button.Label>
          </Button>
        )}
      </div>
    </div>
  )
}

export default CompletionStep
