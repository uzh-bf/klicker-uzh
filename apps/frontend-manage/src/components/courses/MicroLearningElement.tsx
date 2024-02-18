import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faHourglassEnd,
  faHourglassStart,
  faPencil,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  MicroLearning,
  MicroLearningStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Ellipsis } from '@klicker-uzh/markdown'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import StatusTag from './StatusTag'
import DeleteMicroLearningButton from './actions/DeleteMicroLearningButton'
import EditMicroLearningButton from './actions/EditMicroLearningButton'
import MicroLearningAccessLink from './actions/MicroLearningAccessLink'
import MicroLearningPreviewLink from './actions/MicroLearningPreviewLink'
import PublishMicroLearningButton from './actions/PublishMicroLearningButton'
import UnpublishMicroLearningButton from './actions/UnpublishMicroLearningButton'

interface MicroLearningElementProps {
  microLearning: Partial<MicroLearning> & Pick<MicroLearning, 'id' | 'name'>
}

function MicroSessionTile({ microLearning }: MicroLearningElementProps) {
  const t = useTranslations()

  const href = `${process.env.NEXT_PUBLIC_PWA_URL}/micro/${microLearning.id}/`
  const isFuture = dayjs(microLearning.scheduledStartAt).isAfter(dayjs())
  const isPast = dayjs(microLearning.scheduledEndAt).isBefore(dayjs())

  return (
    <div
      className="w-full p-2 border border-solid rounded border-uzh-grey-80"
      data-cy={`microlearning-${microLearning.name}`}
    >
      <div className="flex flex-row items-center justify-between">
        <Ellipsis maxLength={25} className={{ markdown: 'font-bold' }}>
          {microLearning.name || ''}
        </Ellipsis>

        <div className="flex flex-row items-center gap-3 text-sm">
          <MicroLearningAccessLink microLearning={microLearning} href={href} />
          <MicroLearningPreviewLink microLearning={microLearning} href={href} />
          {microLearning.status === MicroLearningStatus.Draft && (
            <>
              <EditMicroLearningButton microLearning={microLearning} />
              <PublishMicroLearningButton microLearning={microLearning} />
              <DeleteMicroLearningButton microLearning={microLearning} />
            </>
          )}

          {microLearning.status === MicroLearningStatus.Published &&
            isFuture && (
              <UnpublishMicroLearningButton microLearning={microLearning} />
            )}

          {microLearning.status === MicroLearningStatus.Draft && (
            <StatusTag
              color="bg-gray-200"
              status={t('shared.generic.draft')}
              icon={faPencil}
            />
          )}
          {microLearning.status === MicroLearningStatus.Published && (
            <StatusTag
              color="bg-green-300"
              status={t('shared.generic.published')}
              icon={isFuture ? faClock : isPast ? faCheck : faPlay}
            />
          )}
        </div>
      </div>
      <div className="mb-1 text-sm italic">
        {t('pwa.microSession.numOfQuestionSets', {
          number: microLearning.numOfStacks || '0',
        })}
      </div>
      <div className="flex flex-row gap-4 text-sm">
        <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faHourglassStart} />
          <div>
            {t('manage.course.startAt', {
              time: dayjs(microLearning.scheduledStartAt)
                .local()
                .format('DD.MM.YYYY, HH:mm'),
            })}
          </div>
        </div>
        <div className="flex flex-row items-center gap-2">
          <FontAwesomeIcon icon={faHourglassEnd} />
          <div>
            {t('manage.course.endAt', {
              time: dayjs(microLearning.scheduledEndAt)
                .local()
                .format('DD.MM.YYYY, HH:mm'),
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MicroSessionTile
