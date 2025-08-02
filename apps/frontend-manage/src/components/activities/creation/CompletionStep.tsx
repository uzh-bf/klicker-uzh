import { faEye } from '@fortawesome/free-regular-svg-icons'
import { faList, faSync, faXmark } from '@fortawesome/free-solid-svg-icons'
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
            <Button data={{ cy: 'load-activity-preview' }}>
              <Button.Icon icon={faEye} />
              <Button.Label>
                {t('manage.activityWizard.openPreview')}
              </Button.Label>
            </Button>
          </Link>
        )}

        <Link href={viewElementHref}>
          <Button data={{ cy: 'open-activity-overview' }}>
            <Button.Icon icon={faList} />
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
            <Button.Icon icon={faXmark} />
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
            data={{ cy: 'create-new-activity' }}
          >
            <Button.Icon icon={faSync} />
            <Button.Label>
              {t('manage.activityWizard.createAnotherActivity')}
            </Button.Label>
          </Button>
        )}
      </div>
    </div>
  )
}

export default CompletionStep
