import { useMutation } from '@apollo/client'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  MicroLearning,
  UnpublishMicroSessionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface UnpublishMicroLearningButtonProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'id' | 'name'>
}

function UnpublishMicroLearningButton({
  microLearning,
}: UnpublishMicroLearningButtonProps) {
  const t = useTranslations()
  const [unpublishMicroSession] = useMutation(UnpublishMicroSessionDocument, {
    variables: { id: microLearning.id },
  })

  return (
    <Button
      basic
      className={{ root: 'text-primary' }}
      onClick={async () => await unpublishMicroSession()}
      data={{ cy: `unpublish-microlearning-${microLearning.name}` }}
    >
      <Button.Icon>
        <FontAwesomeIcon icon={faLock} className="w-[1.1rem]" />
      </Button.Icon>
      <Button.Label>{t('manage.course.unpublishMicrolearning')}</Button.Label>
    </Button>
  )
}

export default UnpublishMicroLearningButton
