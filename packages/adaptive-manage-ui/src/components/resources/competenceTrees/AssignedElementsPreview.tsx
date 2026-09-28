import { faArrowUpRightFromSquare } from '@fortawesome/free-solid-svg-icons'
import { Button, TextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import CompetenceTreePagination from './CompetenceTreePagination'
import ElementPreview from './ElementPreview'
import ItemParameters from './ItemParameters'
import { getBreadcrumb } from './treeHelpers'
import type { CompetenceTreeForm } from './types'

function AssignedElementsPreview({ form }: { form: CompetenceTreeForm }) {
  const t = useTranslations()
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const elements = form.assignments.filter((item) =>
    item.elementName.toLowerCase().includes(search.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(elements.length / pageSize))
  useEffect(() => {
    setPage((current) => Math.min(current, totalPages))
  }, [totalPages])
  return (
    <section data-cy="competence-tree-assigned-preview">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t('manage.competenceTree.assignedElements')}
          </h2>
          <p className="text-sm text-gray-600">
            {t('manage.competenceTree.assignFromLibrary')}
          </p>
        </div>
        <Button
          onClick={() => void router.push('/')}
          data={{ cy: 'competence-tree-open-element-library' }}
        >
          <Button.Icon icon={faArrowUpRightFromSquare} />
          <Button.Label>
            {t('manage.competenceTree.openElementLibrary')}
          </Button.Label>
        </Button>
      </div>
      <TextField
        label={t('manage.competenceTree.assignmentSearch')}
        value={search}
        onChange={(value) => {
          setSearch(value)
          setPage(1)
        }}
        data={{ cy: 'competence-tree-assigned-search' }}
      />
      <ul className="mt-4 divide-y border-y border-gray-200">
        {elements.slice((page - 1) * pageSize, page * pageSize).map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div className="min-w-0">
              <div className="break-words font-medium">{item.elementName}</div>
              <p className="text-sm text-gray-600">
                {[item.leafKey, ...item.additionalLeafKeys]
                  .map((leafKey) => getBreadcrumb(form.nodes, leafKey))
                  .join(', ')}
              </p>
              <p className="text-xs text-gray-500">
                {t(`shared.types.${item.elementType}`)} ·{' '}
                {
                  form.levels.find((level) => level.key === item.levelKey)
                    ?.label
                }{' '}
                ·{' '}
                {t(
                  item.enabled
                    ? 'manage.competenceTree.enabled'
                    : 'manage.competenceTree.assignmentInactive'
                )}
              </p>
              <ItemParameters
                elementId={item.elementId}
                difficulty={item.b}
                guessing={item.c}
                levelLabel={
                  form.levels.find((level) => level.key === item.levelKey)
                    ?.label
                }
              />
            </div>
            <ElementPreview
              elementId={item.elementId}
              name={item.elementName}
            />
          </li>
        ))}
      </ul>
      {elements.length === 0 && (
        <p className="py-4 text-sm text-gray-600">
          {t('manage.competenceTree.noAssignments')}
        </p>
      )}
      <CompetenceTreePagination
        currentPage={page}
        totalPages={totalPages}
        setCurrentPage={setPage}
        pageSize={pageSize}
        setPageSize={(value) => {
          setPageSize(value)
          setPage(1)
        }}
        numOfObjects={elements.length}
      />
    </section>
  )
}
export default AssignedElementsPreview
