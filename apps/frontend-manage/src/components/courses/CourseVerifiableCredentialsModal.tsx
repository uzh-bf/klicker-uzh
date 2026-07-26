import { useMutation, useQuery } from '@apollo/client'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import {
  AssessmentReportCredentialStatus,
  MRevokeCredentialDocument,
  QGetCourseVerificationRecordsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { routing } from '@klicker-uzh/i18n'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Modal,
  Select,
  TextField,
  UserNotification,
  toast,
} from '@uzh-bf/design-system'
import { useLocale, useTranslations } from 'next-intl'
import { useDeferredValue, useEffect, useState } from 'react'
import Pagination from '../common/Pagination'
import CourseVerifiableCredentialsList, {
  type AssessmentReportRecord,
} from './CourseVerifiableCredentialsList'

type StatusFilter = 'ALL' | AssessmentReportCredentialStatus

export default function CourseVerifiableCredentialsModal({
  courseId,
  onClose,
}: {
  courseId: string
  onClose: () => void
}) {
  const t = useTranslations()
  const locale = useLocale()
  const [searchString, setSearchString] = useState('')
  const deferredSearchString = useDeferredValue(searchString)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pendingRevocation, setPendingRevocation] =
    useState<AssessmentReportRecord | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const queryVariables = {
    courseId,
    statusFilter: statusFilter === 'ALL' ? undefined : [statusFilter],
    searchString: deferredSearchString.trim() || undefined,
    numEntries: pageSize,
    offset: (currentPage - 1) * pageSize,
  }

  const { data, loading, error, refetch } = useQuery(
    QGetCourseVerificationRecordsDocument,
    {
      variables: queryVariables,
      fetchPolicy: 'network-only',
    }
  )
  const [revokeAssessmentReport] = useMutation(MRevokeCredentialDocument)

  const page = data?.courseAssessmentReportRecords
  const records = page?.records ?? []
  const totalCount = page?.totalCount ?? 0
  const totalPages = Math.max(Math.ceil(totalCount / pageSize), 1)

  useEffect(() => {
    if (!loading && currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, loading, totalPages])

  function setPageSizeAndReset(value: number | ((previous: number) => number)) {
    setPageSize(value)
    setCurrentPage(1)
  }

  async function copyVerificationLink(record: AssessmentReportRecord) {
    try {
      const baseUrl = (
        process.env.NEXT_PUBLIC_ASSESSMENT_URL ??
        process.env.NEXT_PUBLIC_PWA_URL ??
        'https://assessment.klicker.com'
      ).replace(/\/$/, '')
      const localePrefix = locale === routing.defaultLocale ? '' : `/${locale}`
      await navigator.clipboard.writeText(
        `${baseUrl}${localePrefix}/verify#${record.verificationToken}`
      )
      toast({
        type: 'success',
        message: t('manage.assessment.reportLinkCopied'),
      })
    } catch {
      toast({
        type: 'error',
        message: t('manage.assessment.reportLinkCopyError'),
      })
    }
  }

  async function confirmRevocation() {
    if (!pendingRevocation) return
    const record = pendingRevocation
    setRevokingId(record.id)

    try {
      const response = await revokeAssessmentReport({
        variables: { id: record.id },
      })
      const updatedRecord = response.data?.revokeAssessmentReport
      if (
        !updatedRecord ||
        updatedRecord.status === AssessmentReportCredentialStatus.Active
      ) {
        throw new Error('ASSESSMENT_REPORT_REVOCATION_FAILED')
      }
      setPendingRevocation(null)
      toast({
        type:
          updatedRecord.status === AssessmentReportCredentialStatus.Revoked
            ? 'success'
            : 'warning',
        message:
          updatedRecord.status === AssessmentReportCredentialStatus.Revoked
            ? t('manage.assessment.reportRevocationSuccess')
            : t('manage.assessment.reportAlreadyInactive'),
      })
      try {
        await refetch()
      } catch {
        toast({
          type: 'warning',
          message: t('manage.assessment.reportRecordsRefreshError'),
          options: { duration: 10000 },
        })
      }
    } catch {
      toast({
        type: 'error',
        message: t('manage.assessment.reportRevocationError'),
        options: { duration: 10000 },
      })
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={t('manage.assessment.reportRecordsTitle')}
        className={{
          content: 'min-w-0 max-w-[calc(100%-2rem)] p-4 md:max-w-6xl md:p-6',
        }}
        dataCloseButton={{ cy: 'close-assessment-report-records' }}
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TextField
            id="assessment-report-search"
            label={t('manage.assessment.reportSearchPlaceholder')}
            value={searchString}
            onChange={(value: string) => {
              setSearchString(value)
              setCurrentPage(1)
            }}
            placeholder={t('manage.assessment.reportSearchPlaceholder')}
            icon={faMagnifyingGlass}
            className={{ field: 'w-full md:w-80', input: 'pl-8! h-9' }}
            data={{ cy: 'assessment-report-search' }}
          />
          <div className="w-full md:w-52">
            <label
              htmlFor="assessment-report-status-filter"
              className="mb-1 block text-sm font-semibold"
            >
              {t('manage.assessment.reportStatus')}
            </label>
            <Select
              id="assessment-report-status-filter"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value as StatusFilter)
                setCurrentPage(1)
              }}
              items={[
                {
                  value: 'ALL',
                  label: t('manage.assessment.reportStatusAll'),
                },
                {
                  value: AssessmentReportCredentialStatus.Active,
                  label: t('manage.assessment.reportStatusActive'),
                },
                {
                  value: AssessmentReportCredentialStatus.Revoked,
                  label: t('manage.assessment.reportStatusRevoked'),
                },
                {
                  value: AssessmentReportCredentialStatus.Superseded,
                  label: t('manage.assessment.reportStatusSuperseded'),
                },
              ]}
              className={{ trigger: 'h-9 w-full' }}
              data={{ cy: 'assessment-report-status-filter' }}
            />
          </div>
        </div>

        {error ? (
          <div className="mb-4" role="alert">
            <UserNotification
              type="error"
              message={t('manage.assessment.reportRecordsLoadError')}
            />
          </div>
        ) : null}

        {loading ? (
          <div className="flex h-32 items-center justify-center" role="status">
            <Loader />
          </div>
        ) : error && !data ? null : records.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-600">
            {t('manage.assessment.reportRecordsEmpty')}
          </div>
        ) : (
          <>
            <CourseVerifiableCredentialsList
              records={records}
              locale={locale}
              revokingId={revokingId}
              onCopy={copyVerificationLink}
              onRevoke={setPendingRevocation}
            />
            <Pagination
              totalPages={totalPages}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              numOfObjects={totalCount}
              pageSize={pageSize}
              setPageSize={setPageSizeAndReset}
            />
          </>
        )}
      </Modal>

      {pendingRevocation ? (
        <Modal
          open
          hideCloseButton
          onClose={() => setPendingRevocation(null)}
          title={t('manage.assessment.reportRevokeTitle')}
          secondaryLabel={t('shared.generic.cancel')}
          onSecondaryAction={() => setPendingRevocation(null)}
          primaryLabel={t('manage.assessment.reportRevokeConfirm')}
          primaryButtonStyle="destructive"
          primaryLoading={revokingId === pendingRevocation.id}
          onPrimaryAction={confirmRevocation}
          className={{ content: 'max-w-lg' }}
          dataPrimaryAction={{ cy: 'confirm-assessment-report-revocation' }}
          dataSecondaryAction={{ cy: 'cancel-assessment-report-revocation' }}
        >
          <p className="mb-3 text-base">
            {t('manage.assessment.reportRevokeMessage', {
              email: pendingRevocation.subjectEmail,
            })}
          </p>
          <p className="text-sm text-slate-600">
            {t('manage.assessment.reportRevokePolicy')}
          </p>
        </Modal>
      ) : null}
    </>
  )
}
