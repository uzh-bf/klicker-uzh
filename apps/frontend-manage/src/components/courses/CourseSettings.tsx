import { useMutation } from '@apollo/client'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeCourseColorDocument,
  ChangeCourseDatesDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import {
  Button,
  ColorPicker,
  DateChanger,
  Switch,
  Toast,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import CourseDescription from './CourseDescription'
import EnableGamificationModal from './modals/EnableGamificationModal'

interface CourseSettingsProps {
  id: string
  description?: string | null
  isGamificationEnabled: boolean
  courseColor?: string | null
  startDate: string
  endDate: string
}

function CourseSettings({
  id,
  description,
  isGamificationEnabled,
  courseColor,
  startDate,
  endDate,
}: CourseSettingsProps) {
  const router = useRouter()
  const t = useTranslations()

  const [changeCourseColor] = useMutation(ChangeCourseColorDocument)
  const [changeCourseDates] = useMutation(ChangeCourseDatesDocument)

  const [descriptionEditMode, setDescriptionEditMode] = useState(false)
  const [editStartDate, setEditStartDate] = useState(false)
  const [editEndDate, setEditEndDate] = useState(false)
  const [dateToastSuccess, setDateToastSuccess] = useState(false)
  const [dateToastError, setDateToastError] = useState(false)
  const [enableGamificationModal, setEnableGamificationModal] = useState(false)

  return (
    <>
      {description ? (
        descriptionEditMode ? (
          <CourseDescription
            description={description}
            courseId={router.query.id as string}
            submitText={t('manage.course.saveDescription')}
            setDescriptionEditMode={setDescriptionEditMode}
          />
        ) : (
          <div className="border-uzh-grey-80 prose-p:mb-2 last:prose-p:mb-0 prose-p:mt-0 prose prose-sm prose-blockquote:text-gray-500 flex max-w-none flex-row gap-2 rounded border border-solid leading-6 focus:!outline-none">
            <Markdown
              withProse
              content={description}
              className={{
                root: 'prose-p:mt-0 prose-headings:mt-0 w-full rounded p-2',
              }}
              data={{ cy: 'course-description' }}
            />
            <Button
              onClick={() => setDescriptionEditMode(true)}
              className={{ root: 'h-10' }}
              data={{ cy: 'course-description-edit-button' }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faPencil} />
              </Button.Icon>
            </Button>
          </div>
        )
      ) : (
        <CourseDescription
          description={description ?? '<br>'}
          courseId={router.query.id as string}
          submitText={t('manage.courseList.addDescription')}
          setDescriptionEditMode={setDescriptionEditMode}
        />
      )}
      <div className="flex h-11 flex-row items-center gap-8 pt-1">
        <div>
          <Switch
            disabled={isGamificationEnabled}
            label="Gamification"
            checked={isGamificationEnabled}
            onCheckedChange={async (newValue) => {
              if (newValue) {
                setEnableGamificationModal(true)
              }
            }}
            data={{ cy: 'course-gamification-switch' }}
            className={{ label: 'text-gray-600' }}
          />
        </div>
        <div className="flex flex-row">
          <ColorPicker
            color={courseColor ?? '#0028A5'}
            label={t('manage.courseList.courseColor')}
            onSubmit={(color) =>
              changeCourseColor({ variables: { color, courseId: id } })
            }
            submitText={t('shared.generic.save')}
            colorLabel={t('shared.generic.color')}
            dataTrigger={{ cy: 'course-color-trigger' }}
            dataHexInput={{ cy: 'course-color-hex-input' }}
            dataSubmit={{ cy: 'course-color-submit' }}
          />
        </div>
        <DateChanger
          label={`${t('shared.generic.startDate')}:`}
          date={startDate}
          edit={editStartDate}
          onEdit={() => setEditStartDate(true)}
          onSave={async (date: string) => {
            if (dayjs(date).isBefore(endDate)) {
              const { data } = await changeCourseDates({
                variables: {
                  courseId: id,
                  startDate: date + 'T00:00:00.000Z',
                },
              })
              if (data?.changeCourseDates?.id) {
                setDateToastSuccess(true)
                setEditStartDate(false)
              }
            } else {
              setDateToastError(true)
            }
          }}
          data={{ cy: 'course-start-date' }}
          dataButton={{ cy: 'course-start-date-button' }}
        />
        <DateChanger
          label={`${t('shared.generic.endDate')}:`}
          date={endDate}
          edit={editEndDate}
          onEdit={() => setEditEndDate(true)}
          onSave={async (date: string) => {
            if (dayjs(date).isAfter(startDate)) {
              const { data } = await changeCourseDates({
                variables: {
                  courseId: id,
                  endDate: date + 'T23:59:59.999Z',
                },
              })
              if (data?.changeCourseDates?.id) {
                setDateToastSuccess(true)
                setEditEndDate(false)
              }
            } else {
              setDateToastError(true)
            }
          }}
          data={{ cy: 'course-end-date' }}
          dataButton={{ cy: 'course-end-date-button' }}
        />
        <Toast
          duration={4000}
          openExternal={dateToastSuccess}
          setOpenExternal={setDateToastSuccess}
          type="success"
        >
          {t('manage.course.changedDate')}
        </Toast>
        <Toast
          duration={4000}
          openExternal={dateToastError}
          setOpenExternal={setDateToastError}
          type="error"
        >
          {t('manage.course.dateChangeFailed')}
        </Toast>
        <EnableGamificationModal
          courseId={id}
          open={enableGamificationModal}
          setOpen={setEnableGamificationModal}
        />
      </div>
    </>
  )
}

export default CourseSettings
