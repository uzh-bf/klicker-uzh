import { useQuery } from '@apollo/client'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { GetAssessmentParticipantInvitationsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H1, H2, UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import ParticipantInvitationCsvUpload from '../../../../components/courses/participantInvitations/ParticipantInvitationCsvUpload'
import ParticipantInvitationsTable from '../../../../components/courses/participantInvitations/ParticipantInvitationsTable'
import Layout from '../../../../components/Layout'

function AssessmentParticipantInvitations() {
  const t = useTranslations()
  const router = useRouter()
  const courseId =
    typeof router.query.id === 'string' ? router.query.id : undefined
  const { data, loading, error } = useQuery(
    GetAssessmentParticipantInvitationsDocument,
    {
      variables: { courseId: courseId ?? '' },
      skip: !courseId,
      fetchPolicy: 'network-only',
    }
  )

  if (loading || !courseId) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const invitations = data?.assessmentParticipantInvitations
  if (error || !invitations) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('manage.assessment.invitationLoadingError')}
        />
      </Layout>
    )
  }

  return (
    <Layout>
      <Button
        basic
        onClick={() => router.push(`/courses/${courseId}`)}
        className={{ root: 'mb-3 h-8 px-2 text-sm' }}
        data={{ cy: 'assessment-invitations-back' }}
      >
        <Button.Icon icon={faArrowLeft} />
        <Button.Label>
          {t('manage.assessment.invitationBackToCourse')}
        </Button.Label>
      </Button>

      <div className="mb-6">
        <H1 className={{ root: 'mb-1' }}>
          {t('manage.assessment.participantInvitations')}
        </H1>
        <p className="max-w-3xl text-slate-600">
          {t('manage.assessment.participantInvitationsDescription')}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <ParticipantInvitationCsvUpload courseId={courseId} />

        <section aria-labelledby="invitation-list-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <H2 id="invitation-list-title" className={{ root: 'mb-1' }}>
                {t('manage.assessment.invitationListTitle')}
              </H2>
              <p className="text-sm text-slate-600">
                {t('manage.assessment.invitationListDescription')}
              </p>
            </div>
            <span className="text-sm font-medium text-slate-700">
              {t('manage.assessment.invitationCount', {
                count: invitations.length,
              })}
            </span>
          </div>
          <ParticipantInvitationsTable
            courseId={courseId}
            invitations={invitations}
          />
        </section>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default AssessmentParticipantInvitations
