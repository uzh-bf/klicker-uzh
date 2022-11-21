import { useMutation, useQuery } from '@apollo/client'
import ContentInput from '@components/questions/ContentInput'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeCourseDescriptionDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { Button, H2 } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as Yup from 'yup'
import Layout from '../../components/Layout'

function CourseOverviewPage() {
  const router = useRouter()

  const [descriptionEditMode, setDescriptionEditMode] = useState(false)

  const {
    loading: loadingCourse,
    error: errorCourse,
    data: dataCourse,
  } = useQuery(GetSingleCourseDocument, {
    variables: { courseId: router.query.id as string },
  })

  const [changeCourseDescription] = useMutation(ChangeCourseDescriptionDocument)

  console.log(dataCourse)

  if (loadingCourse) return <div>Loading...</div>
  if ((!dataCourse && !loadingCourse) || errorCourse) {
    router.push('/404')
  }

  const descriptionSchema = Yup.object().shape({
    description: Yup.string().test({
      message: 'Bitte fügen Sie einen Inhalt zu Ihrer Kursbeschreibung hinzu',
      test: (content) => !content?.match(/^(<br>(\n)*)$/g) && content !== '',
    }),
  })

  const changeDescription = (
    description: string,
    setSubmitting: (isSubmitting: boolean) => void
  ) => {
    setSubmitting(true)
    if (!description.match(/^(<br>(\n)*)$/g) && description !== '') {
      changeCourseDescription({
        variables: {
          courseId: router.query.id as string,
          input: description,
        },
      })
    }
    setDescriptionEditMode(false)
    setSubmitting(false)
  }

  return (
    <Layout>
      <div className="w-full">
        <H2>Kurs: {dataCourse?.course?.displayName}</H2>
        {dataCourse?.course?.description ? (
          descriptionEditMode ? (
            <Formik
              initialValues={{ description: dataCourse?.course?.description }}
              onSubmit={(values, { setSubmitting }) =>
                changeDescription(values.description, setSubmitting)
              }
              validationSchema={descriptionSchema}
            >
              {({
                values,
                setFieldValue,
                isSubmitting,
                isValid,
                touched,
                errors,
              }) => (
                <div className="flex-1">
                  <Form>
                    <ContentInput
                      placeholder="Beschreibung hinzufügen"
                      touched={touched.description}
                      content={values.description}
                      onChange={(newValue: string) =>
                        setFieldValue('description', newValue)
                      }
                    />

                    <div className="flex flex-row justify-between mt-1">
                      {errors && (
                        <div className="text-sm text-red-700">
                          {errors.description}
                        </div>
                      )}
                      <Button
                        className="float-right px-5 text-white bg-uzh-blue-80 disabled:opacity-60"
                        type="submit"
                        disabled={isSubmitting || !isValid}
                      >
                        <Button.Icon className="mr-1">
                          <FontAwesomeIcon icon={faSave} />
                        </Button.Icon>
                        <Button.Label>Beschreibung speichern</Button.Label>
                      </Button>
                    </div>
                  </Form>
                </div>
              )}
            </Formik>
          ) : (
            <div className="flex flex-row gap-2 border border-solid rounded border-uzh-grey-80">
              <Markdown
                content={dataCourse.course.description}
                className="w-full p-2 rounded"
              />
              <Button onClick={() => setDescriptionEditMode(true)}>
                <Button.Icon>
                  <FontAwesomeIcon icon={faPencil} />
                </Button.Icon>
                <Button.Label>Beschreibung bearbeiten</Button.Label>
              </Button>
            </div>
          )
        ) : (
          <Formik
            initialValues={{ description: '<br>' }}
            onSubmit={(values, { setSubmitting }) =>
              changeDescription(values.description, setSubmitting)
            }
            validationSchema={descriptionSchema}
          >
            {({
              values,
              setFieldValue,
              isSubmitting,
              isValid,
              touched,
              errors,
            }) => (
              <div className="flex-1">
                <Form>
                  <ContentInput
                    placeholder="Beschreibung hinzufügen"
                    touched={touched.description}
                    content={values.description}
                    onChange={(newValue: string) =>
                      setFieldValue('description', newValue)
                    }
                  />

                  <div className="flex flex-row justify-between mt-1">
                    {errors && (
                      <div className="text-sm text-red-700">
                        {errors.description}
                      </div>
                    )}
                    <Button
                      className="float-right px-5 text-white bg-uzh-blue-80 disabled:opacity-60"
                      type="submit"
                      disabled={isSubmitting || !isValid}
                    >
                      <Button.Icon className="mr-1">
                        <FontAwesomeIcon icon={faSave} />
                      </Button.Icon>
                      <Button.Label>Beschreibung hinzufügen</Button.Label>
                    </Button>
                  </div>
                </Form>
              </div>
            )}
          </Formik>
        )}
      </div>
    </Layout>
  )
}

export default CourseOverviewPage
