import { useMutation, useQuery } from '@apollo/client'
import {
  MRevokeCredentialDocument,
  QGetCourseVerificationRecordsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

export default function CourseVerifiableCredentialsModal({
  courseId,
  onClose,
}: {
  courseId: string
  onClose: () => void
}) {
  const t = useTranslations()

  const { data, loading, error, refetch } = useQuery(
    QGetCourseVerificationRecordsDocument,
    {
      variables: { courseId },
      fetchPolicy: 'network-only',
    }
  )

  const [revokeCredential, { loading: revoking }] = useMutation(
    MRevokeCredentialDocument
  )

  const handleRevoke = async (id: string) => {
    if (
      !window.confirm(
        'Möchten Sie dieses Zertifikat wirklich widerrufen? / Are you sure you want to revoke this credential?'
      )
    ) {
      return
    }
    try {
      await revokeCredential({
        variables: { id },
      })
      refetch()
    } catch (e) {
      console.error('Failed to revoke credential', e)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Ausgestellte Leistungsberichte / Issued Performance Reports"
      className={{ content: 'max-w-4xl' }}
    >
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader />
        </div>
      ) : error ? (
        <UserNotification
          type="error"
          message="Fehler beim Laden der Leistungsberichte / Error loading credentials"
        />
      ) : !data?.courseVerificationRecords ||
        data.courseVerificationRecords.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">
          Für diesen Kurs wurden noch keine Leistungsberichte ausgestellt.
          <br />
          No performance reports have been issued for this course yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="text-2xs bg-slate-50 uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  Empfänger / Recipient
                </th>
                <th className="px-4 py-3 font-semibold">Token / ID</th>
                <th className="px-4 py-3 font-semibold">
                  Ausgestellt / Issued At
                </th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">
                  Aktionen / Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {data.courseVerificationRecords.map((record) => {
                const metadata = record.metadata as any
                const email = metadata?.studentEmail || 'N/A'

                return (
                  <tr key={record.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {email}
                    </td>
                    <td className="text-2xs select-all break-all px-4 py-3 font-mono text-slate-500">
                      {record.token}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(record.issuedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {record.isRevoked ? (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                          Widerrufen / Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700 ring-1 ring-inset ring-green-600/10">
                          Aktiv / Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!record.isRevoked && (
                        <Button
                          onClick={() => handleRevoke(record.id)}
                          disabled={revoking}
                          className={{
                            root: 'text-2xs rounded-md border border-red-200/50 bg-red-50 px-2 py-1 font-medium text-red-600 transition-all hover:bg-red-100/70',
                          }}
                        >
                          <Button.Label>Widerrufen / Revoke</Button.Label>
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
