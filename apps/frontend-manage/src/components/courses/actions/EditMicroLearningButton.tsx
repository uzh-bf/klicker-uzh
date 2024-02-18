import { WizardMode } from '@components/sessions/creation/SessionCreation'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MicroLearning } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'

interface EditMicroLearningButtonProps {
  microLearning: Partial<MicroLearning>
}

function EditMicroLearningButton({
  microLearning,
}: EditMicroLearningButtonProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <Button
      basic
      className={{ root: 'text-primary' }}
      onClick={() =>
        router.push({
          pathname: '/',
          query: {
            sessionId: microLearning.id,
            editMode: WizardMode.Microlearning,
          },
        })
      }
      data={{ cy: `edit-microlearning-${microLearning.name}` }}
    >
      <Button.Icon>
        <FontAwesomeIcon icon={faPencil} />
      </Button.Icon>
      <Button.Label>{t('manage.course.editMicrolearning')}</Button.Label>
    </Button>
  )
}

export default EditMicroLearningButton
