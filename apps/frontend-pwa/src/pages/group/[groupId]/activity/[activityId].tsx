import { useMutation, useQuery } from '@apollo/client'
import {
  GroupActivityDetailsDocument,
  StartGroupActivityDocument,
  SubmitGroupActivityDecisionsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import { QuestionType } from '@type/app'
import { Button, H1, ThemeContext } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useContext } from 'react'
import { twMerge } from 'tailwind-merge'
import { array, number, object, string } from 'yup'
import { Options } from '../../../../components/common/OptionsDisplay'
import Layout from '../../../../components/Layout'

function GroupActivityDetails() {
  const theme = useContext(ThemeContext)
  const router = useRouter()

  const { data, loading, error } = useQuery(GroupActivityDetailsDocument, {
    variables: {
      groupId: router.query.groupId,
      activityId: router.query.activityId,
    },
  })

  const [startGroupActivity, { loading: startLoading }] = useMutation(
    StartGroupActivityDocument,
    {
      variables: {
        groupId: router.query.groupId,
        activityId: router.query.activityId,
      },
      refetchQueries: [
        {
          query: GroupActivityDetailsDocument,
          variables: {
            groupId: router.query.groupId,
            activityId: router.query.activityId,
          },
        },
      ],
    }
  )

  const [submitGroupActivityDecisions, { loading: submitLoading }] =
    useMutation(SubmitGroupActivityDecisionsDocument, {
      refetchQueries: [
        {
          query: GroupActivityDetailsDocument,
          variables: {
            groupId: router.query.groupId,
            activityId: router.query.activityId,
          },
        },
      ],
    })

  if (!data || loading) {
    return <Layout></Layout>
  }

  if (!data.groupActivityDetails) {
    return (
      <Layout>
        Die Gruppenquest wird am 07.11.2022 ab 17:00 freigeschalten.
      </Layout>
    )
  }

  if (error) {
    return <Layout>Error: {error.message}</Layout>
  }

  return (
    <Layout
      course={data.groupActivityDetails.course}
      displayName={data.groupActivityDetails.displayName}
    >
      <Head>
        <base target="_blank" />
      </Head>

      <div className="flex flex-col lg:gap-12 p-4 mx-auto border rounded max-w-[1800px] lg:flex-row">
        <div className="lg:flex-1">
          <div className="">
            <H1>Ausgangslage</H1>

            <Markdown
              className={{
                root: 'prose max-w-none prose-img:max-w-[250px] prose-img:mx-auto prose-p:mt-0',
              }}
              content={data.groupActivityDetails.description}
            />
          </div>

          <div className="py-4">
            <H1>Eure Hinweise</H1>

            <div className="grid grid-cols-1 gap-2 mt-2 text-xs md:grid-cols-2">
              {!data.groupActivityDetails.activityInstance &&
                data.groupActivityDetails.clues.map((clue) => {
                  return (
                    <div
                      key={clue.id}
                      className="px-3 py-2 border rounded shadow"
                    >
                      <div className="font-bold">{clue.displayName}</div>
                    </div>
                  )
                })}
              {data.groupActivityDetails.activityInstance &&
                data.groupActivityDetails.activityInstance.clues.map((clue) => {
                  return (
                    <div
                      className={twMerge(
                        'flex flex-row items-center gap-2 py-2 border rounded shadow',
                        clue.participant.isSelf && theme.primaryBorder
                      )}
                      key={clue.participant.id}
                    >
                      <div className="flex flex-col items-center flex-none w-24 px-4">
                        <Image
                          src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
                            clue.participant.avatar ?? 'placeholder'
                          }.svg`}
                          alt=""
                          height={25}
                          width={30}
                        />
                        <div
                          className={twMerge(
                            clue.participant.isSelf && 'font-bold'
                          )}
                        >
                          {clue.participant.username}
                        </div>
                      </div>
                      <div>
                        <div className="font-bold">{clue.displayName}</div>
                        {typeof clue.value === 'string' && (
                          <div>
                            {clue.type === 'NUMBER'
                              ? Number(
                                  clue.unit === '%'
                                    ? clue.value * 100
                                    : clue.value
                                ).toLocaleString()
                              : clue.value}{' '}
                            {clue.unit}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
            <div className="p-2 mt-4 text-sm text-center rounded text-slate-500 bg-slate-100">
              Jedes Gruppenmitglied erhält ein/mehrere der obigen Hinweise.
              <br />
              Sprecht euch ab, um alle nötigen Hinweise für die Aufgaben zu
              sammeln.
            </div>
          </div>
        </div>

        <div className="lg:flex-1">
          {!data.groupActivityDetails?.activityInstance && (
            <div className="flex flex-col pt-4 lg:pt-0">
              <H1>Deine Gruppe</H1>

              <div className="flex flex-row gap-2">
                {data.groupActivityDetails.group.participants.map(
                  (participant) => (
                    <div
                      key={participant.id}
                      className="border rounded shadow w-[100px] h-full p-2 flex flex-col items-center"
                    >
                      <Image
                        src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
                          participant.avatar ?? 'placeholder'
                        }.svg`}
                        alt=""
                        height={40}
                        width={50}
                      />
                      <div>{participant.username}</div>
                    </div>
                  )
                )}
              </div>

              <p className="mt-4 prose max-w-none">
                Ist deine Gruppe vollständig? Wenn ja, klicke auf Start, um die
                Hinweise unter deinen Gruppenmitgliedern zu verteilen.
                Mitglieder, die nach der Zuweisung zu der Gruppe stossen,
                erhalten keine zusätzlichen Hinweise.
              </p>
              <Button
                disabled={
                  data.groupActivityDetails.group.participants.length === 1
                }
                loading={startLoading}
                className={{ root: 'self-end mt-4 text-lg font-bold' }}
                onClick={() => startGroupActivity()}
              >
                START
              </Button>

              {data.groupActivityDetails.group.participants.length === 1 && (
                <div className="p-2 mt-4 text-sm text-center text-red-500 bg-red-100 rounded">
                  Gruppen mit einem Mitglied können leider nicht an der
                  Gruppenquest teilnehmen.
                  <br />. Suche dir mindestens eine:n Partner:in, um
                  mitzumachen, oder schaue dir die Aufgabe im Excel an, die wir
                  nach der Abgabefrist publizieren.
                </div>
              )}
            </div>
          )}

          {data.groupActivityDetails.activityInstance && (
            <div className="py-4 lg:pt-0">
              <H1>Eure Aufgaben</H1>
              <Formik
                isInitialValid={false}
                initialValues={data.groupActivityDetails.instances.reduce(
                  (acc, instance) => {
                    if (
                      instance.questionData.type === QuestionType.NUMERICAL ||
                      instance.questionData.type === QuestionType.FREE_TEXT
                    ) {
                      const previousDecision =
                        data.groupActivityDetails?.activityInstance.decisions?.find(
                          (decision) => decision.id === instance.id
                        )

                      return {
                        ...acc,
                        [instance.id]: previousDecision?.response ?? '',
                      }
                    }

                    const previousDecision =
                      data.groupActivityDetails?.activityInstance.decisions?.find(
                        (decision) => decision.id === instance.id
                      )

                    return {
                      ...acc,
                      [instance.id]: previousDecision?.selectedOptions ?? [],
                    }
                  },
                  {}
                )}
                validationSchema={object().shape(
                  data.groupActivityDetails.instances.reduce(
                    (acc, instance) => {
                      if (
                        instance.questionData.type === QuestionType.NUMERICAL
                      ) {
                        return {
                          ...acc,
                          [instance.id]: number().required(),
                        }
                      }

                      if (
                        instance.questionData.type === QuestionType.FREE_TEXT
                      ) {
                        return {
                          ...acc,
                          [instance.id]: string().required().min(1),
                        }
                      }

                      return {
                        ...acc,
                        [instance.id]: array()
                          .required()
                          .of(number().required())
                          .min(1),
                      }
                    },
                    {}
                  )
                )}
                onSubmit={async (values, { setSubmitting }) => {
                  submitGroupActivityDecisions({
                    variables: {
                      activityInstanceId:
                        data.groupActivityDetails.activityInstance?.id,
                      decisions: Object.entries(values).map(([id, value]) => {
                        if (Array.isArray(value)) {
                          return {
                            id: Number(id),
                            selectedOptions: value,
                          }
                        }

                        return {
                          id: Number(id),
                          response: value,
                        }
                      }),
                    },
                  })
                }}
              >
                {({
                  values,
                  isSubmitting,
                  setFieldValue,
                  errors,
                  isValid,
                  touched,
                }) => (
                  <Form className="flex flex-col">
                    <div className="flex-1">
                      {data.groupActivityDetails.instances.map((instance) => (
                        <div
                          key={instance.id}
                          className="py-4 space-y-2 border-b last:border-b-0 first:lg:pt-0"
                        >
                          <Markdown content={instance.questionData.content} />
                          <Options
                            disabled={
                              !!data.groupActivityDetails.activityInstance
                                .decisions
                            }
                            isCompact
                            isResponseValid={
                              touched[instance.id] && !errors[instance.id]
                            }
                            questionType={instance.questionData.type}
                            options={instance.questionData.options}
                            response={values[instance.id] ?? ''}
                            onChangeResponse={(response) => {
                              setFieldValue(instance.id, response, true)
                            }}
                          />
                        </div>
                      ))}
                    </div>

                    {!data.groupActivityDetails.activityInstance.decisions ? (
                      <div className="flex flex-col">
                        <Button
                          type="submit"
                          loading={isSubmitting}
                          disabled={!isValid}
                          className={{
                            root: 'self-end mt-4 text-lg font-bold',
                          }}
                        >
                          Antworten absenden
                        </Button>
                        <div className="p-2 mt-4 text-sm text-center text-orange-700 bg-orange-200 rounded">
                          Jede Gruppe kann nur einmal Lösungen einreichen.
                          Sendet eure Lösungen erst ab, wenn ihr euch sicher
                          seid.
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 mt-4 text-sm text-center rounded text-slate-500 bg-slate-100">
                        Deine Gruppe hat ihre Lösungen bereits eingereicht (am{' '}
                        {dayjs(
                          data.groupActivityDetails.activityInstance
                            .decisionsSubmittedAt
                        ).format('DD.MM.YYYY HH:mm:ss')}
                        ).
                        <br />
                        Die Bewertung wird später veröffentlicht und separat
                        kommuniziert.
                      </div>
                    )}
                  </Form>
                )}
              </Formik>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default GroupActivityDetails
