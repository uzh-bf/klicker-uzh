import { faCheck, faRotate } from '@fortawesome/free-solid-svg-icons'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { CompetenceTreeForm, CompetenceTreeValidationView } from './types'
import { getValidationGuidance } from './validationGuidance'

function IssueList({
  issues,
  type,
  onJumpToSection,
}: {
  issues: ReturnType<typeof getValidationGuidance>
  type: 'error' | 'warning'
  onJumpToSection?: (sectionId: string, nodeKey?: string) => void
}) {
  const t = useTranslations()

  const jumpToSection = (sectionId: string, nodeKey?: string) => {
    if (onJumpToSection) {
      onJumpToSection(sectionId, nodeKey)
      return
    }
    const section = document.getElementById(sectionId)
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    section.focus({ preventScroll: true })
  }

  return (
    <ul className="divide-y divide-slate-200 border-y border-slate-200">
      {issues.map(
        ({ issue, messageKey, name, sectionId, nodeKey, actionKey }, index) => {
          return (
            <li
              key={`${issue.code}-${issue.path ?? index}`}
              className={`flex flex-wrap items-start justify-between gap-3 border-l-4 px-3 py-2 text-sm ${
                type === 'error' ? 'border-red-600' : 'border-amber-500'
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium">
                  {t(`manage.competenceTree.guidance.${messageKey}`, {
                    name: name || t('manage.competenceTree.guidance.unnamed'),
                  })}
                </div>
                {messageKey === 'other' && (
                  <details className="mt-1 text-slate-600">
                    <summary className="cursor-pointer">
                      {t('manage.competenceTree.guidance.technicalDetails')}
                    </summary>
                    <p className="mt-1 break-words">{issue.message}</p>
                  </details>
                )}
              </div>
              {sectionId && (
                <Button
                  basic
                  onClick={() => jumpToSection(sectionId, nodeKey)}
                  data={{
                    cy: `competence-tree-validation-jump-${type}-${index}`,
                  }}
                  className={{ root: 'shrink-0' }}
                >
                  <Button.Label>
                    {t(`manage.competenceTree.guidance.${actionKey}`)}
                  </Button.Label>
                </Button>
              )}
            </li>
          )
        }
      )}
    </ul>
  )
}

function ValidationPanel({
  form,
  validation,
  requestError,
  loading,
  onValidate,
  disabled,
  onJumpToSection,
}: {
  form: CompetenceTreeForm
  validation: CompetenceTreeValidationView | null
  requestError: string | null
  loading: boolean
  onValidate: () => void
  disabled: boolean
  onJumpToSection?: (sectionId: string, nodeKey?: string) => void
}) {
  const t = useTranslations()
  const errors = getValidationGuidance(validation?.errors ?? [], form)
  const warnings = getValidationGuidance(validation?.warnings ?? [], form)

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
              count: errors.length,
            })}
          </h3>
          <IssueList
            issues={errors}
            type="error"
            onJumpToSection={onJumpToSection}
          />
        </div>
      )}

      {validation && validation.warnings.length > 0 && (
        <div data-cy="competence-tree-validation-warnings">
          <h3 className="mb-2 font-semibold text-amber-700">
            {t('manage.competenceTree.validationWarnings', {
              count: warnings.length,
            })}
          </h3>
          <IssueList
            issues={warnings}
            type="warning"
            onJumpToSection={onJumpToSection}
          />
        </div>
      )}
    </section>
  )
}

export default ValidationPanel
