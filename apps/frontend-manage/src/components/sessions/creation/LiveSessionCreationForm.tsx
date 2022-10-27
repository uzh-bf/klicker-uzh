import { Button, H3, Label, Select, Switch } from '@uzh-bf/design-system'
import { ErrorMessage, Field, Form, Formik } from 'formik'
import { twMerge } from 'tailwind-merge'
import * as yup from 'yup'
import EditorField from './EditorField'
import TextField from './TextField'

interface LiveSessionCreationFormProps {
  courses?: {
    label: string
    value: string
  }[]
}

function LiveSessionCreationForm({ courses }: LiveSessionCreationFormProps) {
  const liveSessionCreationSchema = yup.object().shape({
    name: yup
      .string()
      .required('Bitte geben Sie einen Namen für Ihre Session ein.'),
    displayName: yup
      .string()
      .required('Bitte geben Sie einen Anzeigenamen für Ihre Session ein.'),
    description: yup.string(),
    blocks: yup
      .array()
      .of(
        yup
          .array()
          .of(
            yup
              .string()
              .required(
                'Jedes Frageblock muss mindestens eine FrageId enthalten.'
              )
          )
          .min(
            1,
            'Bitte beachten das Eingabteformat beachten und sicherstellen, dass jeder Block mind. eine Frage enthält. Für Sessions ohne Fragen bitten den Default-Block löschen.'
          )
      ),
    courseId: yup.string(),
    isGamificationActive: yup
      .boolean()
      .required('Bitte spezifizieren Sie, ob die Session gamified sein soll.'),
  })

  return (
    <div>
      <H3>Live-Session erstellen</H3>
      <Formik
        initialValues={{
          name: '',
          displayName: '',
          description: '',
          blocks: [['2', '200'], ['3', '4'], ['100']],
          courseId: courses ? courses[0].value : '',
          isGamificationActive: false,
        }}
        isInitialValid={false}
        validationSchema={liveSessionCreationSchema}
        onSubmit={async (values) => {
          // TODO: creation session with corresponding mutation
          // TODO: remove possibly existing whitespaces from questionId strings and cast them to numbers and remove empty strings
          // TODO: if numbers were entered without a space in between, they can still be of the form 33,33,33 and have to be split up here
          console.log(values)
          alert('submission triggered')
        }}
      >
        {({
          values,
          errors,
          touched,
          setFieldValue,
          isSubmitting,
          isValid,
        }) => {
          return (
            <div>
              {/* {errors.name}, {errors.displayName},{errors.isGamificationActive},
              {errors.description}, {errors.courseId} */}
              <Form className="">
                <TextField
                  label="Session-Name"
                  tooltip="Dieser Name der Session soll Ihnen ermöglichen diese Session von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld."
                  field="name"
                  error={errors.name}
                  touched={touched.name}
                  className="mb-1"
                />
                <TextField
                  label="Anzeigenamen"
                  tooltip="Dieser Session-Name wird den Teilnehmenden bei der Durchführung angezeigt."
                  field="displayName"
                  error={errors.displayName}
                  touched={touched.displayName}
                  className="mb-1"
                />

                <EditorField
                  label="Beschreibung"
                  field={values.description}
                  fieldName="description"
                  setFieldValue={setFieldValue}
                  error={errors.description}
                  touched={touched.description}
                />
                <div className="w-full text-right">
                  <ErrorMessage
                    name="description"
                    component="div"
                    className="text-sm text-red-400"
                  />
                </div>

                {/* // TODO: add possibility to add and remove blocks */}
                <div className="mb-2">
                  <div className="flex flex-row items-center flex-1 gap-2">
                    <Label
                      label="Blocks:"
                      className="font-bold"
                      tooltip="Fügen Sie hier die Fragen Ihrer Session hinzu - Format Frage-Ids: ##, ##, ###. Jeder Block kann beliebig viele Fragen enthalten. Die Blöcke werden den Teilnehmenden in der eingegebenen Reihenfolge angezeigt."
                      showTooltipSymbol={true}
                      tooltipStyle="font-normal text-sm !w-1/2 opacity-100"
                    />
                    {values.blocks.map((block, index) => (
                      <div key={index} className="flex flex-col">
                        <div>Block {index + 1}</div>
                        <Field
                          id={`blocks.${index}`}
                          value={block.join(', ')}
                          onChange={(e: any) => {
                            setFieldValue(
                              `blocks[${index}]`,
                              e.target.value
                                .replace(/[^0-9\s,]/g, '')
                                .split(', ')
                            )
                          }}
                          type="text"
                          className={twMerge(
                            'w-48 rounded bg-uzh-grey-20 border border-uzh-grey-60 focus:border-uzh-blue-50 h-9',
                            errors.blocks &&
                              touched.blocks &&
                              'border-red-400 bg-red-50'
                          )}
                        />
                      </div>
                    ))}
                  </div>
                  <ErrorMessage
                    name="blocks"
                    component="div"
                    className="text-sm text-red-400"
                  />
                </div>

                <div className="flex flex-row items-center">
                  <Label
                    label="Optionen"
                    className="my-auto mr-2 font-bold min-w-max"
                    tooltipStyle="text-sm font-normal !w-1/2 opacity-100"
                  />
                  {courses && (
                    <>
                      <div className="mr-2">Kurs:</div>
                      <Select
                        items={courses}
                        onChange={(newValue: string) =>
                          setFieldValue('courseId', newValue)
                        }
                      />
                    </>
                  )}
                  <Switch
                    label="Gamification"
                    id="gamification-switch"
                    checked={values.isGamificationActive}
                    onCheckedChange={(newValue: boolean) =>
                      setFieldValue('isGamificationActive', newValue)
                    }
                    className="ml-4"
                  />
                </div>
                <Button
                  className="float-right"
                  type="submit"
                  disabled={isSubmitting || !isValid}
                >
                  Erstellen
                </Button>
              </Form>
            </div>
          )
        }}
      </Formik>
    </div>
  )
}

export default LiveSessionCreationForm
