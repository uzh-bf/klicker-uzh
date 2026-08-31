import {
  Button,
  FormikNumberField,
  FormikTextField,
} from '@uzh-bf/design-system'
import { FieldArray, type FieldArrayRenderProps } from 'formik'
import { nanoid } from 'nanoid'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ElementFormTypesFreeText } from '../types'

function FreeTextRubricEditor({
  values,
  disabled,
}: {
  values: ElementFormTypesFreeText
  disabled: boolean
}) {
  const t = useTranslations()
  const rubrics = values.options.semanticEvaluation?.rubric_schema.rubrics ?? []
  const [rubricKeys, setRubricKeys] = useState(() =>
    rubrics.map(() => nanoid())
  )
  const [levelKeys, setLevelKeys] = useState(() =>
    rubrics.map((rubric) => rubric.achievement_levels.map(() => nanoid()))
  )

  return (
    <section className="flex flex-col gap-3" data-cy="semantic-rubrics">
      <div>
        <h4 className="font-semibold">
          {t('manage.elements.semanticRubrics')}
        </h4>
        <p className="text-sm text-gray-600">
          {t('manage.elements.semanticRubricsDescription')}
        </p>
      </div>
      <FieldArray name="options.semanticEvaluation.rubric_schema.rubrics">
        {({ push, remove }: FieldArrayRenderProps) => (
          <div className="flex flex-col gap-3">
            {rubrics.map((rubric, rubricIndex) => (
              <div
                key={rubricKeys[rubricIndex]!}
                className="rounded-md border border-gray-300 p-3"
                data-cy={`semantic-rubric-${rubricIndex}`}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <FormikTextField
                    id={`semantic-rubric-id-${rubricIndex}`}
                    required
                    disabled={disabled}
                    name={`options.semanticEvaluation.rubric_schema.rubrics.${rubricIndex}.id`}
                    label={t('manage.elements.semanticRubricId')}
                    data={{ cy: `semantic-rubric-id-${rubricIndex}` }}
                  />
                  <FormikTextField
                    id={`semantic-rubric-name-${rubricIndex}`}
                    required
                    disabled={disabled}
                    name={`options.semanticEvaluation.rubric_schema.rubrics.${rubricIndex}.name`}
                    label={t('shared.generic.name')}
                    data={{ cy: `semantic-rubric-name-${rubricIndex}` }}
                  />
                  <div className="md:col-span-2">
                    <FormikTextField
                      id={`semantic-rubric-description-${rubricIndex}`}
                      required
                      disabled={disabled}
                      name={`options.semanticEvaluation.rubric_schema.rubrics.${rubricIndex}.description`}
                      label={t('shared.generic.description')}
                      data={{
                        cy: `semantic-rubric-description-${rubricIndex}`,
                      }}
                    />
                  </div>
                  <FormikNumberField
                    id={`semantic-rubric-weight-${rubricIndex}`}
                    required
                    disabled={disabled}
                    name={`options.semanticEvaluation.rubric_schema.rubrics.${rubricIndex}.weight`}
                    label={t('manage.elements.semanticRubricWeight')}
                    min={0}
                    max={1}
                    precision={2}
                    data={{ cy: `semantic-rubric-weight-${rubricIndex}` }}
                  />
                </div>

                <FieldArray
                  name={`options.semanticEvaluation.rubric_schema.rubrics.${rubricIndex}.achievement_levels`}
                >
                  {({
                    push: pushLevel,
                    remove: removeLevel,
                  }: FieldArrayRenderProps) => (
                    <div className="mt-3 flex flex-col gap-2">
                      <h5 className="text-sm font-semibold">
                        {t('manage.elements.semanticAchievementLevels')}
                      </h5>
                      {rubric.achievement_levels.map((_level, levelIndex) => (
                        <div
                          key={levelKeys[rubricIndex]![levelIndex]!}
                          className="grid gap-2 rounded bg-gray-50 p-2 md:grid-cols-[1fr_2fr_8rem_auto] md:items-end"
                          data-cy={`semantic-rubric-${rubricIndex}-level-${levelIndex}`}
                        >
                          <FormikTextField
                            id={`semantic-rubric-${rubricIndex}-level-name-${levelIndex}`}
                            required
                            disabled={disabled}
                            name={`options.semanticEvaluation.rubric_schema.rubrics.${rubricIndex}.achievement_levels.${levelIndex}.name`}
                            label={t('shared.generic.name')}
                            data={{
                              cy: `semantic-rubric-${rubricIndex}-level-name-${levelIndex}`,
                            }}
                          />
                          <FormikTextField
                            id={`semantic-rubric-${rubricIndex}-level-description-${levelIndex}`}
                            required
                            disabled={disabled}
                            name={`options.semanticEvaluation.rubric_schema.rubrics.${rubricIndex}.achievement_levels.${levelIndex}.description`}
                            label={t('shared.generic.description')}
                            data={{
                              cy: `semantic-rubric-${rubricIndex}-level-description-${levelIndex}`,
                            }}
                          />
                          <FormikNumberField
                            id={`semantic-rubric-${rubricIndex}-level-score-${levelIndex}`}
                            required
                            disabled={disabled}
                            name={`options.semanticEvaluation.rubric_schema.rubrics.${rubricIndex}.achievement_levels.${levelIndex}.normalized_score`}
                            label={t('manage.elements.semanticNormalizedScore')}
                            min={0}
                            max={100}
                            precision={0}
                            data={{
                              cy: `semantic-rubric-${rubricIndex}-level-score-${levelIndex}`,
                            }}
                          />
                          {!disabled && (
                            <Button
                              type="button"
                              destructive
                              disabled={rubric.achievement_levels.length <= 1}
                              onClick={() => {
                                setLevelKeys((keys) =>
                                  keys.map((rubricLevelKeys, index) =>
                                    index === rubricIndex
                                      ? rubricLevelKeys.filter(
                                          (_key, keyIndex) =>
                                            keyIndex !== levelIndex
                                        )
                                      : rubricLevelKeys
                                  )
                                )
                                removeLevel(levelIndex)
                              }}
                              data={{
                                cy: `semantic-rubric-${rubricIndex}-delete-level-${levelIndex}`,
                              }}
                            >
                              {t('shared.generic.delete')}
                            </Button>
                          )}
                        </div>
                      ))}
                      {!disabled && (
                        <Button
                          type="button"
                          onClick={() => {
                            setLevelKeys((keys) =>
                              keys.map((rubricLevelKeys, index) =>
                                index === rubricIndex
                                  ? [...rubricLevelKeys, nanoid()]
                                  : rubricLevelKeys
                              )
                            )
                            pushLevel({
                              name: '',
                              description: '',
                              normalized_score: 0,
                            })
                          }}
                          data={{
                            cy: `semantic-rubric-${rubricIndex}-add-level`,
                          }}
                        >
                          {t('manage.elements.semanticAddAchievementLevel')}
                        </Button>
                      )}
                    </div>
                  )}
                </FieldArray>

                {!disabled && (
                  <Button
                    type="button"
                    destructive
                    disabled={rubrics.length <= 1}
                    onClick={() => {
                      setRubricKeys((keys) =>
                        keys.filter(
                          (_key, keyIndex) => keyIndex !== rubricIndex
                        )
                      )
                      setLevelKeys((keys) =>
                        keys.filter(
                          (_key, keyIndex) => keyIndex !== rubricIndex
                        )
                      )
                      remove(rubricIndex)
                    }}
                    className={{ root: 'mt-3' }}
                    data={{ cy: `semantic-delete-rubric-${rubricIndex}` }}
                  >
                    {t('manage.elements.semanticDeleteRubric')}
                  </Button>
                )}
              </div>
            ))}
            {!disabled && (
              <Button
                type="button"
                onClick={() => {
                  setRubricKeys((keys) => [...keys, nanoid()])
                  setLevelKeys((keys) => [...keys, [nanoid()]])
                  push({
                    id: `rubric-${nanoid()}`,
                    name: '',
                    description: '',
                    weight: 0,
                    achievement_levels: [
                      {
                        name: '',
                        description: '',
                        normalized_score: 0,
                      },
                    ],
                  })
                }}
                data={{ cy: 'semantic-add-rubric' }}
              >
                {t('manage.elements.semanticAddRubric')}
              </Button>
            )}
          </div>
        )}
      </FieldArray>
    </section>
  )
}

export default FreeTextRubricEditor
