import { useMutation, useQuery } from '@apollo/client'
import {
  CompetenceTreeSummaryDataFragment,
  GetActiveUserCoursesDocument,
  LinkCompetenceTreeToCourseDocument,
  UnlinkCompetenceTreeFromCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, Modal, Switch, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

function CourseLinksModal({
  tree,
  onClose,
  onChanged,
}: {
  tree: CompetenceTreeSummaryDataFragment
  onClose: () => void
  onChanged: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [linkedCourseIds, setLinkedCourseIds] = useState(
    () => new Set(tree.courseLinks.map((link) => link.courseId))
  )
  const [pendingCourseId, setPendingCourseId] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const { data, loading, error } = useQuery(GetActiveUserCoursesDocument, {
    fetchPolicy: 'cache-and-network',
  })
  const [linkTree] = useMutation(LinkCompetenceTreeToCourseDocument)
  const [unlinkTree] = useMutation(UnlinkCompetenceTreeFromCourseDocument)
  const courses = useMemo(() => {
    const activeCourses = data?.getActiveUserCourses ?? []
    const activeCourseIds = new Set(activeCourses.map((course) => course.id))
    return [
      ...activeCourses
        .filter((course) => course.isEditor || linkedCourseIds.has(course.id))
        .map((course) => ({
          id: course.id,
          name: course.name,
          displayName: course.displayName,
          active: true,
          canEdit: course.isEditor === true,
        })),
      ...tree.courseLinks
        .filter(
          (link) =>
            !activeCourseIds.has(link.courseId) &&
            linkedCourseIds.has(link.courseId)
        )
        .map((link) => ({
          id: link.courseId,
          name: link.courseName,
          displayName: link.courseDisplayName,
          active: false,
          canEdit: true,
        })),
    ].sort((a, b) => a.name.localeCompare(b.name))
  }, [data?.getActiveUserCourses, linkedCourseIds, tree.courseLinks])

  const updateLink = async (courseId: string, linked: boolean) => {
    setPendingCourseId(courseId)
    setRequestError(null)
    try {
      if (linked) {
        await linkTree({ variables: { treeId: tree.id, courseId } })
      } else {
        await unlinkTree({ variables: { treeId: tree.id, courseId } })
      }

      setLinkedCourseIds((current) => {
        const next = new Set(current)
        if (linked) next.add(courseId)
        else next.delete(courseId)
        return next
      })
      await onChanged()
    } catch (mutationError) {
      setRequestError(
        mutationError instanceof Error
          ? mutationError.message
          : t('manage.competenceTree.courseLinkError')
      )
    } finally {
      setPendingCourseId(null)
    }
  }

  return (
    <Modal
      open
      title={t('manage.competenceTree.courseLinksTitle', {
        tree: tree.displayName,
      })}
      onClose={onClose}
      data={{ cy: 'competence-tree-course-links-modal' }}
      className={{ content: 'max-w-2xl' }}
    >
      <p className="mb-4 text-sm text-slate-600">
        {t('manage.competenceTree.courseLinksDescription')}
      </p>

      {(requestError || error) && (
        <UserNotification
          type="error"
          message={requestError ?? error?.message ?? ''}
          data={{ cy: 'competence-tree-course-links-error' }}
          className={{ root: 'mb-4' }}
        />
      )}

      {loading && !data ? (
        <Loader />
      ) : (
        <div className="max-h-96 overflow-y-auto border-y border-slate-200">
          {courses.map((course) => {
            const linked = linkedCourseIds.has(course.id)
            const pending = pendingCourseId === course.id

            return (
              <div
                key={course.id}
                className="flex min-h-12 items-center justify-between gap-4 border-t border-slate-200 px-2 py-2 first:border-t-0"
                data-cy={`competence-tree-course-link-${course.id}`}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {course.name}
                  </div>
                  <div className="truncate text-xs text-slate-500">
                    {course.displayName}
                  </div>
                  {!course.active && (
                    <div className="mt-0.5 text-xs font-medium text-amber-700">
                      {t('manage.competenceTree.inactiveCourse')}
                    </div>
                  )}
                  {!course.canEdit && (
                    <div className="mt-0.5 text-xs font-medium text-slate-600">
                      {t('manage.competenceTree.courseWriteRequired')}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-slate-600">
                    {t(
                      linked
                        ? 'manage.competenceTree.linked'
                        : 'manage.competenceTree.notLinked'
                    )}
                  </span>
                  <label
                    htmlFor={`competence-tree-course-link-switch-${course.id}`}
                    className="sr-only"
                  >
                    {t('manage.competenceTree.courseLinkSwitchLabel', {
                      course: course.name,
                    })}
                  </label>
                  <Switch
                    id={`competence-tree-course-link-switch-${course.id}`}
                    checked={linked}
                    onCheckedChange={(nextLinked) =>
                      void updateLink(course.id, nextLinked)
                    }
                    disabled={pendingCourseId !== null || !course.canEdit}
                    size="sm"
                    data={{
                      cy: `competence-tree-course-link-switch-${course.id}`,
                    }}
                  />
                  {pending && (
                    <span className="text-xs text-slate-500">
                      {t('manage.competenceTree.updating')}
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {courses.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-600">
              {t('manage.competenceTree.noActiveCourses')}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button
          onClick={onClose}
          data={{ cy: 'competence-tree-course-links-close' }}
        >
          <Button.Label>{t('manage.competenceTree.close')}</Button.Label>
        </Button>
      </div>
    </Modal>
  )
}

export default CourseLinksModal
