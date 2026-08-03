import { faArrowUp, faCheck, faRotate } from '@fortawesome/free-solid-svg-icons'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  CompetenceTreeValidationIssueView,
  CompetenceTreeValidationView,
} from './types'

function IssueList({
  issues,
  type,
}: {
  issues: CompetenceTreeValidationIssueView[]
  type: 'error' | 'warning'
}) {
  const t = useTranslations()

  const getSectionId = (path?: string | null) => {
    if (!path) return null
    const root = path.split(/[.[\]]/, 1)[0]
    if (root === 'levels') return 'competence-tree-section-levels'
    if (root === 'nodes') return 'competence-tree-section-nodes'
    if (root === 'coverages') return 'competence-tree-section-coverages'
    if (root === 'assignments') return 'competence-tree-section-assignments'
    if (
      [
        'metadata',
        'name',
        'displayName',
        'description',
        'maxDepth',
        'thetaMin',
        'thetaMax',
        'defaultDiscrimination',
        'levelMappingRule',
      ].includes(root)
    ) {
      return 'competence-tree-section-metadata'
    }
    return null
  }

  const jumpToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    section.focus({ preventScroll: true })
  }

  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-200">
      {issues.map((issue, index) => {
        const sectionId = getSectionId(issue.path)

        return (
          <li
            key={`${issue.code}-${issue.path ?? index}`}
            className={`flex items-start justify-between gap-3 border-l-4 px-3 py-2 text-sm ${
              type === 'error' ? 'border-red-600' : 'border-amber-500'
            }`}
          >
            <div className="min-w-0">
              <div className="font-medium">{issue.message}</div>
            </div>
            {sectionId && (
              <Button
                basic
                onClick={() => jumpToSection(sectionId)}
                aria-label={t('manage.competenceTree.jumpToSection')}
                title={t('manage.competenceTree.jumpToSection')}
                data={{
                  cy: `competence-tree-validation-jump-${type}-${index}`,
                }}
                className={{ root: 'h-8 w-8 shrink-0 p-0' }}
              >
                <Button.Icon withoutLabel icon={faArrowUp} />
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function ValidationPanel({
  validation,
  requestError,
  loading,
  onValidate,
  disabled,
}: {
  validation: CompetenceTreeValidationView | null
  requestError: string | null
  loading: boolean
  onValidate: () => void
  disabled: boolean
}) {
  const t = useTranslations()

  return (
    <section
      className="border-t border-slate-300 py-5"
      data-cy="competence-tree-validation"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t('manage.competenceTree.validationTitle')}
          </h2>
          <p className="text-sm text-slate-600">
            {t('manage.competenceTree.validationDescription')}
          </p>
        </div>
        <Button
          onClick={onValidate}
          loading={loading}
          disabled={disabled}
          data={{ cy: 'competence-tree-validate' }}
        >
          <Button.Icon icon={validation ? faRotate : faCheck} />
          <Button.Label>{t('manage.competenceTree.validate')}</Button.Label>
        </Button>
      </div>

      {requestError && (
        <UserNotification
          type="error"
          message={requestError}
          data={{ cy: 'competence-tree-validation-request-error' }}
          className={{ root: 'mb-4' }}
        />
      )}

      {!validation && !requestError && (
        <UserNotification
          type="info"
          message={t('manage.competenceTree.validationNotRun')}
          data={{ cy: 'competence-tree-validation-not-run' }}
        />
      )}

      {validation && validation.errors.length === 0 && (
        <UserNotification
          type="success"
          message={t('manage.competenceTree.validationValid')}
          data={{ cy: 'competence-tree-validation-valid' }}
          className={{ root: 'mb-4 !text-slate-800' }}
        />
      )}

      {validation && validation.errors.length > 0 && (
        <div className="mb-5" data-cy="competence-tree-validation-errors">
          <h3 className="mb-2 font-semibold text-red-700">
            {t('manage.competenceTree.validationErrors', {
              count: validation.errors.length,
            })}
          </h3>
          <IssueList issues={validation.errors} type="error" />
        </div>
      )}

      {validation && validation.warnings.length > 0 && (
        <div data-cy="competence-tree-validation-warnings">
          <h3 className="mb-2 font-semibold text-amber-700">
            {t('manage.competenceTree.validationWarnings', {
              count: validation.warnings.length,
            })}
          </h3>
          <IssueList issues={validation.warnings} type="warning" />
        </div>
      )}
    </section>
  )
}

export default ValidationPanel
