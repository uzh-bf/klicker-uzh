import { useQuery } from '@apollo/client'
import { faHandPointer } from '@fortawesome/free-regular-svg-icons'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import { Dropdown, H1, Toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import CourseQRModal from '../sessions/cockpit/CourseQRModal'
import { getLTIAccessLink } from './PracticeQuizElement'

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

  const [copyToast, setCopyToast] = useState(false)

  const { data: dataUser } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  return (
    <div className="flex flex-row items-center justify-between">
      <H1 data={{ cy: 'course-name-with-pin' }} className={{ root: 'flex-1' }}>
        {t('manage.course.nameWithPin', {
          name: name,
          pin: String(pinCode)
            .match(/.{1,3}/g)
            ?.join(' '),
        })}
      </H1>
      <div className="mb-2 flex flex-row items-center gap-3">
        <div className="italic">
          {t('manage.course.nParticipants', {
            number: numOfParticipants,
          })}
        </div>

        <CourseQRModal
          relativeLink={`/course/${id}/join?pin=${pinCode}`}
          triggerText={t('manage.course.joinCourse')}
          className={{ modal: '' }}
          dataTrigger={{ cy: 'course-join-button' }}
          dataModal={{ cy: 'course-join-modal' }}
          dataCloseButton={{ cy: 'course-join-modal-close' }}
        />

        {dataUser?.userProfile?.catalyst && (
          <Dropdown
            data={{ cy: `course-actions-${name}` }}
            className={{
              trigger: 'px-2 py-4',
              item: 'p-1 hover:bg-gray-200',
              viewport: 'bg-white',
            }}
            trigger={t('manage.course.otherActions')}
            items={[
              dataUser?.userProfile?.catalyst
                ? [
                    getLTIAccessLink({
                      href: `/course/${id}`,
                      setCopyToast,
                      t,
                      name,
                      label: t('manage.course.linkLTILeaderboardLabel'),
                    }),
                    getLTIAccessLink({
                      href: `/course/${id}/docs`,
                      setCopyToast,
                      t,
                      name,
                      label: t('manage.course.linkLTIDocsLabel'),
                    }),
                  ]
                : [],
            ].flat()}
            triggerIcon={faHandPointer}
          />
        )}
      </div>

      <Toast
        openExternal={copyToast}
        setOpenExternal={setCopyToast}
        type="success"
        className={{ root: 'w-[24rem]' }}
      >
        {t('manage.course.linkLTICopied')}
      </Toast>
    </div>
  )
}

export default CourseOverviewHeader
