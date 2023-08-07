import { faX } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface CreationTitleProps {
  text: string
  editMode: boolean
  closeWizard: () => void
}

function CreationTitle({ text, editMode, closeWizard }: CreationTitleProps) {
  const t = useTranslations()
  return (
    <div className="flex flex-row justify-between items-center mb-1">
      <div />
      <H2 className={{ root: 'flex-1' }}>
        {editMode
          ? t('manage.questionForms.editElement', { element: text })
          : t('manage.questionForms.createElement', { element: text })}
      </H2>
      <Button
        className={{ root: 'ml-auto -mt-1 border-red-400' }}
        onClick={closeWizard}
        data={{ cy: 'cancel-session-creation' }}
      >
        <FontAwesomeIcon icon={faX} />
        <div>
          {editMode
            ? t('manage.questionForms.cancelEditing')
            : t('manage.questionForms.cancelCreation')}
        </div>
      </Button>
    </div>
  )
}

export default CreationTitle
