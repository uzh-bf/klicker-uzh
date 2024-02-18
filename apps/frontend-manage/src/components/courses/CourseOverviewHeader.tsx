import { H1, H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import CourseQRModal from '../sessions/cockpit/CourseQRModal'

interface CourseOverviewHeaderProps {
  id: string
  name: string
  pinCode: number
  numOfParticipants: number
}

function CourseOverviewHeader({
  id,
  name,
  pinCode,
  numOfParticipants,
}: CourseOverviewHeaderProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-row items-center justify-between">
      <H1 data={{ cy: 'course-name-with-pin' }}>
        {t('manage.course.nameWithPin', {
          name: name,
          pin: String(pinCode)
            .match(/.{1,3}/g)
            ?.join(' '),
        })}
      </H1>
      <div className="flex flex-row items-center gap-4 mb-2">
        <CourseQRModal
          relativeLink={`/course/${id}/join?pin=${pinCode}`}
          triggerText={t('manage.course.joinCourse')}
          className={{ modal: 'w-[40rem]' }}
          dataTrigger={{ cy: 'course-join-button' }}
          dataModal={{ cy: 'course-join-modal' }}
          dataCloseButton={{ cy: 'course-join-modal-close' }}
        >
          <H2>{t('manage.course.joinCourse')}</H2>
          <Link
            href={`${process.env.NEXT_PUBLIC_PWA_URL}/course/${id}/join?pin=${pinCode}`}
            target="_blank"
            className="text-primary"
            legacyBehavior
            passHref
          >
            <a data-cy="link-to-pwa-course-join-page">
              {`${process.env.NEXT_PUBLIC_PWA_URL}/course/${id}/join?pin=${pinCode}`}
            </a>
          </Link>

          <div className="mt-4">
            {t.rich('manage.course.requiredPin', {
              b: (text) => <strong>{text}</strong>,
              pin: String(pinCode)
                .match(/.{1,3}/g)
                ?.join(' '),
            })}
          </div>
        </CourseQRModal>
        <div className="italic">
          {t('manage.course.nParticipants', {
            number: numOfParticipants,
          })}
        </div>
      </div>
    </div>
  )
}

export default CourseOverviewHeader
