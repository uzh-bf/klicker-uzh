import { useMutation } from '@apollo/client'
import { faLock } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  MicroLearning,
  UnpublishMicroLearningDocument,
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
  const [unpublishMicrolearning, { loading: unpublishing }] = useMutation(
    UnpublishMicroLearningDocument,
    {
      variables: { id: microLearning.id },
    }
  )

  return (
    <Button
      basic
      disabled={unpublishing}
      className={{ root: 'text-primary-100' }}
      onClick={async () => await unpublishMicrolearning()}
      data={{ cy: `unpublish-microlearning-${microLearning.name}` }}
    >
      <Button.Icon>
        <FontAwesomeIcon icon={faLock} className="w-[1.2rem]" />
      </Button.Icon>
      <Button.Label>{t('manage.course.unpublishMicrolearning')}</Button.Label>
    </Button>
  )
}

export default UnpublishMicroLearningButton
