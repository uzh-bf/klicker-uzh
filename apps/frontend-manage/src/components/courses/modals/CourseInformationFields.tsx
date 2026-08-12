import { FormikTextField } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import EditorField from '../../activities/creation/EditorField'

// shared name / display name / description fields of the course creation,
// manipulation, and duplication modals (all based on the same formik shape)
function CourseInformationFields() {
  const t = useTranslations()

  return (
    <>
      <div className="flex w-full flex-col gap-3 md:flex-row">
        <FormikTextField
          name="name"
          label={t('manage.courseList.courseName')}
          placeholder={t('manage.courseList.courseName')}
          tooltip={t('manage.courseList.courseNameTooltip')}
          className={{ root: 'w-full md:w-1/2' }}
          data={{ cy: 'course-name' }}
          required
        />
        <FormikTextField
          name="displayName"
          label={t('manage.activityWizard.displayName')}
          placeholder={t('manage.courseList.courseDisplayName')}
          tooltip={t('manage.courseList.courseDisplayNameTooltip')}
          className={{ root: 'w-full md:w-1/2' }}
          data={{ cy: 'course-display-name' }}
          required
        />
      </div>
      <EditorField
        fieldName="description"
        label={t('shared.generic.description')}
        placeholder={t('manage.courseList.addDescription')}
        tooltip={t('manage.courseList.courseDescriptionTooltip')}
        data={{ cy: 'course-description' }}
        className={{ input: { editor: 'h-20' } }}
        showToolbarOnFocus={false}
      />
    </>
  )
}

export default CourseInformationFields
