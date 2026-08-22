import { useQuery } from '@apollo/client'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import {
  GetAssessmentParticipantInvitationsDocument,
  type GetAssessmentParticipantInvitationsQueryVariables,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H1, H2, UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import Pagination, {
  isPaginationPageSize,
  type PaginationPageSize,
} from '../../../../components/common/Pagination'
import ParticipantInvitationCsvUpload from '../../../../components/courses/participantInvitations/ParticipantInvitationCsvUpload'
import ParticipantInvitationsTable from '../../../../components/courses/participantInvitations/ParticipantInvitationsTable'
import Layout from '../../../../components/Layout'

type InvitationPageSize = Exclude<PaginationPageSize, 'all'>

function AssessmentParticipantInvitations() {
  const t = useTranslations()
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<InvitationPageSize>(() => {
    if (typeof window !== 'undefined') {
      const storedPageSize = window.localStorage.getItem(
        'assessment-invitation-page-size'
      )
      if (storedPageSize) {
        try {
          const parsedPageSize = JSON.parse(storedPageSize) as unknown
          if (
            isPaginationPageSize(parsedPageSize) &&
            parsedPageSize !== 'all'
          ) {
            return parsedPageSize
          }
        } catch (error) {
          console.error(
            'Error parsing stored assessment-invitation-page-size',
            error
          )
        }
      }
    }
    return 50
  })
  const courseId =
    typeof router.query.id === 'string' ? router.query.id : undefined
  const queryVariables: GetAssessmentParticipantInvitationsQueryVariables = {
    courseId: courseId ?? '',
    numEntries: pageSize,
    offset: (currentPage - 1) * pageSize,
  }
  const { data, loading, error } = useQuery(
    GetAssessmentParticipantInvitationsDocument,
    {
      variables: queryVariables,
      skip: !courseId,
      fetchPolicy: 'network-only',
    }
  )

  const totalCount = data?.assessmentParticipantInvitations?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  useEffect(() => {
    if (!loading && currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, loading, totalPages])
  useEffect(() => {
    window.localStorage.setItem(
      'assessment-invitation-page-size',
      JSON.stringify(pageSize)
    )
  }, [pageSize])

  if (loading || !courseId) {
    return (
      <Layout>
        <Loader />
      </Layout>
    )
  }

  const invitationPage = data?.assessmentParticipantInvitations
  if (error || !invitationPage) {
    return (
      <Layout>
        <UserNotification
          type="error"
          message={t('manage.assessment.invitationLoadingError')}
        />
      </Layout>
    )
  }

  const invitations = invitationPage.invitations

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
        <ParticipantInvitationCsvUpload
          courseId={courseId}
          queryVariables={queryVariables}
          onImportCompleted={() => setCurrentPage(1)}
        />

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
                count: totalCount,
              })}
            </span>
          </div>
          <ParticipantInvitationsTable
            courseId={courseId}
            invitations={invitations}
            queryVariables={queryVariables}
            onInvitationDeleted={() => setCurrentPage(1)}
          />
          {totalCount > 0 ? (
            <Pagination
              totalPages={totalPages}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              numOfObjects={totalCount}
              pageSize={pageSize}
              setPageSize={(value) => {
                if (value !== 'all') setPageSize(value)
              }}
            />
          ) : null}
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
