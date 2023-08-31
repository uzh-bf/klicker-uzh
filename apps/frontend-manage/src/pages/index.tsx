import { useMutation, useQuery, useSuspenseQuery } from '@apollo/client'
import {
  ChangeInitialSettingsDocument,
  GetUserQuestionsDocument,
  Question,
  ToggleIsArchivedDocument,
  UserProfileDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useRouter } from 'next/router'
import * as R from 'ramda'
import { Suspense, useEffect, useMemo, useState } from 'react'
import * as Yup from 'yup'
import useSortingAndFiltering from '../lib/hooks/useSortingAndFiltering'

import {
  faArchive,
  faChalkboardUser,
  faGraduationCap,
  faInbox,
  faMagnifyingGlass,
  faSort,
  faSortAsc,
  faSortDesc,
  faUserGroup,
  faUsersLine,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  Checkbox,
  FormikSelectField,
  FormikTextField,
  H1,
  Modal,
  Select,
  TextField,
  Tooltip,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { buildIndex, processItems } from 'src/lib/utils/filters'
import Layout from '../components/Layout'
import QuestionEditModal from '../components/questions/QuestionEditModal'
import QuestionList from '../components/questions/QuestionList'
import TagList from '../components/questions/tags/TagList'
import CreationButton from '../components/sessions/creation/CreationButton'
import SessionCreation from '../components/sessions/creation/SessionCreation'

interface Props {
  setCreationMode: (
    mode: 'liveSession' | 'microSession' | 'learningElement' | 'groupTask'
  ) => void
}

function SuspendedCreationButtons({ setCreationMode }: Props) {
  const t = useTranslations()

  const { data } = useSuspenseQuery(UserProfileDocument)

  return (
    <div className="grid gap-1 mb-4 md:grid-cols-4 md:gap-2">
      <CreationButton
        icon={faUsersLine}
        text={t('manage.questionPool.createLiveSession')}
        onClick={() => {
          setCreationMode('liveSession')
        }}
        data={{ cy: 'create-live-session' }}
      />
      <CreationButton
        isCatalystRequired
        disabled={!data?.userProfile?.catalyst}
        icon={faChalkboardUser}
        text={t('manage.questionPool.createMicroSession')}
        onClick={() => {
          setCreationMode('microSession')
        }}
        data={{ cy: 'create-micro-session' }}
      />
      <CreationButton
        isCatalystRequired
        disabled={!data?.userProfile?.catalyst}
        icon={faGraduationCap}
        text={t('manage.questionPool.createLearningElement')}
        onClick={() => {
          setCreationMode('learningElement')
        }}
        data={{ cy: 'create-learning-element' }}
      />
      <CreationButton
        comingSoon
        isCatalystRequired
        disabled={true || !data?.userProfile?.catalyst}
        icon={faUserGroup}
        text={t('manage.questionPool.createGroupTask')}
        onClick={() => {
          setCreationMode('groupTask')
        }}
        data={{ cy: 'create-group-task' }}
      />
    </div>
  )
}

function SuspensedFirstLoginModal() {
  const [firstLogin, setFirstLogin] = useState(false)
  const [showGenericError, setShowGenericError] = useState(false)

  const { data } = useSuspenseQuery(UserProfileDocument)
  const [changeInitialSettings] = useMutation(ChangeInitialSettingsDocument)
  const t = useTranslations()

  useEffect(() => {
    if (data?.userProfile?.firstLogin) {
      setFirstLogin(true)
    }
  }, [data.userProfile])

  if (!firstLogin) {
    return null
  }

  return (
    <Modal
      open={firstLogin}
      onClose={() => null}
      hideCloseButton
      className={{ content: 'w-full sm:w-3/4 md:w-2/3' }}
    >
      <H1 className={{ root: 'text-4xl' }}>{t('manage.firstLogin.welcome')}</H1>
      <div className="mb-2">{t('manage.firstLogin.makeFirstSettings')}</div>
      {data.userProfile ? (
        <Formik
          validationSchema={Yup.object().shape({
            shortname: Yup.string()
              .required(t('manage.settings.shortnameRequired'))
              .min(5, t('manage.settings.shortnameMin'))
              .max(8, t('manage.settings.shortnameMax'))
              .matches(
                /^[a-zA-Z0-9]*$/,
                t('manage.settings.shortnameAlphanumeric')
              ),
          })}
          initialValues={{
            shortname: data.userProfile.shortname,
            locale: data.userProfile.locale,
          }}
          onSubmit={async (values, { setSubmitting, setErrors }) => {
            setShowGenericError(false)
            setSubmitting(true)

            const result = await changeInitialSettings({
              variables: {
                shortname: values.shortname,
                locale: values.locale,
              },
            })

            if (!result) {
              setShowGenericError(true)
            } else if (
              result.data?.changeInitialSettings?.shortname !== values.shortname
            ) {
              setErrors({
                shortname: t('manage.settings.shortnameTaken'),
              })
            } else {
              setFirstLogin(false)
            }

            setSubmitting(false)
          }}
        >
          {({ isValid, isSubmitting }) => (
            <Form>
              <div className="md:mb-5 mb-1">
                <div className="flex flex-col md:flex-row gap-2 mb-2">
                  <FormikTextField
                    label={t('shared.generic.shortname')}
                    name="shortname"
                    className={{ root: 'w-full md:w-1/2' }}
                    required
                  />
                  <FormikSelectField
                    label={t('shared.generic.language')}
                    name="locale"
                    items={[
                      { label: t('shared.generic.english'), value: 'en' },
                      { label: t('shared.generic.german'), value: 'de' },
                    ]}
                    className={{ root: 'w-full md:w-1/2' }}
                    required
                  />
                </div>
                {showGenericError && (
                  <UserNotification type="error">
                    {t('shared.generic.systemError')}
                  </UserNotification>
                )}
              </div>
              <div className="mb-2">{t('manage.firstLogin.watchVideo')}</div>
              <iframe
                id="kmsembed-0_q6tfn51u"
                src="https://uzh.mediaspace.cast.switch.ch/embed/secure/iframe/entryId/0_q6tfn51u/uiConfId/23448425/st/0"
                className="kmsembed mx-auto rounded-xl w-[90%] h-[25rem]"
                allowFullScreen
                allow="autoplay *; fullscreen *; encrypted-media *"
                referrerPolicy="no-referrer-when-downgrade"
                sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
                title="KlickerUZH - Core Concepts"
              />
              <Button
                className={{
                  root: 'mt-4 w-32 justify-center float-right bg-primary-80 text-white',
                }}
                disabled={!isValid || isSubmitting}
                type="submit"
              >
                {isSubmitting ? <Loader /> : t('shared.generic.save')}
              </Button>
            </Form>
          )}
        </Formik>
      ) : (
        <Loader />
      )}
    </Modal>
  )
}

function Index() {
  const router = useRouter()
  const t = useTranslations()

  const [toggleIsArchived] = useMutation(ToggleIsArchivedDocument)

  const [searchInput, setSearchInput] = useState('')
  const [creationMode, setCreationMode] = useState<
    undefined | 'liveSession' | 'microSession' | 'learningElement' | 'groupTask'
  >(undefined)
  const [isQuestionCreationModalOpen, setIsQuestionCreationModalOpen] =
    useState(false)
  const [sortBy, setSortBy] = useState('')

  const [selectedQuestions, setSelectedQuestions] = useState<
    Record<number, Question | undefined>
  >({})

  const selectedQuestionData: Record<number, Question> = useMemo(
    () => R.pickBy((value) => typeof value !== 'undefined', selectedQuestions),
    [selectedQuestions]
  )

  const {
    loading: loadingQuestions,
    error: errorQuestions,
    data: dataQuestions,
  } = useQuery(GetUserQuestionsDocument)

  const {
    filters,
    sort,
    handleSearch,
    handleSortByChange,
    handleSortOrderToggle,
    handleTagClick,
    handleReset,
    handleToggleArchive,
    handleSampleSolutionClick,
    handleAnswerFeedbacksClick,
  } = useSortingAndFiltering()

  useEffect((): void => {
    router.prefetch('/sessions/running')
    router.prefetch('/sessions')

    if (router.query.sessionId) {
      setCreationMode(router.query.editMode as any)
    }
  }, [router])

  const index = useMemo(() => {
    if (dataQuestions?.userQuestions) {
      return buildIndex('questions', dataQuestions.userQuestions, [
        'name',
        'createdAt',
      ])
    }
    return null
  }, [dataQuestions?.userQuestions])

  const processedQuestions = useMemo(() => {
    if (dataQuestions?.userQuestions) {
      const items = processItems(
        dataQuestions?.userQuestions,
        filters,
        sort,
        index
      )
      return items
    }
  }, [dataQuestions?.userQuestions, filters, index, sort])

  const sortIcon = useMemo(() => {
    if (!sortBy) {
      return faSort
    }

    if (sort.asc) {
      return faSortAsc
    }

    return faSortDesc
  }, [sortBy, sort.asc])

  return (
    <Layout
      displayName={t('manage.general.questionPool')}
      data={{ cy: 'homepage' }}
      className={{ children: 'pb-2' }}
    >
      {typeof creationMode === 'undefined' && (
        <Suspense fallback={<div />}>
          <SuspendedCreationButtons setCreationMode={setCreationMode} />
        </Suspense>
      )}
      {creationMode && (
        <div className="flex-none mb-4">
          <SessionCreation
            creationMode={creationMode}
            closeWizard={() => {
              router.push('/')
              setCreationMode(() => undefined)
            }}
            sessionId={router.query.sessionId as string}
            editMode={router.query.editMode as string}
            selection={selectedQuestionData}
            resetSelection={() => setSelectedQuestions({})}
          />
        </div>
      )}

      <div className="flex flex-col flex-1 gap-4 overflow-y-auto md:flex-row">
        {dataQuestions && dataQuestions.userQuestions && (
          <div>
            <div className="hidden h-full md:block">
              <TagList
                key={creationMode}
                compact={!!creationMode}
                activeTags={filters.tags}
                activeType={filters.type}
                sampleSolution={filters.sampleSolution}
                answerFeedbacks={filters.answerFeedbacks}
                handleReset={handleReset}
                handleTagClick={handleTagClick}
                handleSampleSolutionClick={handleSampleSolutionClick}
                handleAnswerFeedbacksClick={handleAnswerFeedbacksClick}
                handleToggleArchive={handleToggleArchive}
                isArchiveActive={filters.archive}
              />
            </div>
            <div className="md:hidden">
              <TagList
                compact
                key={creationMode}
                activeTags={filters.tags}
                activeType={filters.type}
                sampleSolution={filters.sampleSolution}
                answerFeedbacks={filters.answerFeedbacks}
                handleReset={handleReset}
                handleTagClick={handleTagClick}
                handleSampleSolutionClick={handleSampleSolutionClick}
                handleAnswerFeedbacksClick={handleAnswerFeedbacksClick}
                handleToggleArchive={handleToggleArchive}
                isArchiveActive={filters.archive}
              />
            </div>
          </div>
        )}
        <div className="flex flex-col flex-1 w-full overflow-auto">
          {!dataQuestions || loadingQuestions ? (
            <Loader />
          ) : (
            <>
              <div className="flex flex-row content-center justify-between flex-none">
                <div className="flex flex-row items-center gap-1 pb-3">
                  <div className="flex flex-col text-sm pr-0.5">
                    <Checkbox
                      checked={
                        Object.values(selectedQuestions).filter(
                          (value) => value
                        ).length == processedQuestions?.length
                      }
                      partial={
                        Object.values(selectedQuestions).filter(
                          (value) => value
                        ).length > 0
                      }
                      onCheck={() => {
                        setSelectedQuestions((prev) => {
                          let allQuestions = {}

                          if (processedQuestions) {
                            if (!R.isEmpty(selectedQuestionData)) {
                              // set questions after filtering to undefined
                              // do not uncheck questions that are selected but not in the filtered set
                              allQuestions = processedQuestions.reduce(
                                (acc, curr) => ({
                                  ...acc,
                                  [curr.id]: undefined,
                                }),
                                {}
                              )
                            } else {
                              // set all questions after filtering to their id and data
                              allQuestions = processedQuestions.reduce(
                                (acc, question) => ({
                                  ...acc,
                                  [question.id]: question,
                                }),
                                {}
                              )
                            }
                          }

                          return { ...prev, ...allQuestions }
                        })
                      }}
                    />
                    {t('manage.questionPool.numSelected', {
                      count: Object.keys(selectedQuestionData).length,
                      total: processedQuestions?.length,
                    })}
                  </div>

                  <TextField
                    placeholder={t('manage.general.searchPlaceholder')}
                    value={searchInput}
                    onChange={(newValue: string) => {
                      setSearchInput(newValue)
                      handleSearch(newValue)
                    }}
                    icon={faMagnifyingGlass}
                    className={{
                      input: 'h-10 pl-9',

                      field: 'w-30 pr-3 rounded-md',
                    }}
                  />

                  <div className="flex flex-row gap-1 pr-3">
                    <Button
                      disabled={!sortBy}
                      onClick={() => {
                        handleSortOrderToggle()
                      }}
                      className={{
                        root: 'h-10 shadow-sm rounded-md',
                      }}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={sortIcon} />
                      </Button.Icon>
                    </Button>
                    <Select
                      className={{
                        root: 'min-w-30',
                        trigger: 'h-10',
                      }}
                      placeholder={t('manage.general.sortBy')}
                      items={[
                        { value: 'CREATED', label: t('manage.general.date') },
                        { value: 'TITLE', label: t('manage.general.title') },
                      ]}
                      onChange={(newSortBy: string) => {
                        setSortBy(newSortBy)
                        handleSortByChange(newSortBy)
                      }}
                    />
                  </div>

                  {Object.keys(selectedQuestionData).length > 0 && (
                    <>
                      <Tooltip tooltip={t('manage.questionPool.moveToArchive')}>
                        <Button
                          className={{
                            root: 'h-10 ml-1',
                          }}
                          onClick={async () => {
                            await toggleIsArchived({
                              variables: {
                                questionIds:
                                  Object.keys(selectedQuestionData).map(Number),
                                isArchived: true,
                              },
                            })
                            setSelectedQuestions({})
                          }}
                        >
                          <FontAwesomeIcon icon={faArchive} />
                        </Button>
                      </Tooltip>
                      <Tooltip
                        tooltip={t('manage.questionPool.restoreFromArchive')}
                      >
                        <Button
                          className={{
                            root: 'h-10 ml-1',
                          }}
                          onClick={async () => {
                            await toggleIsArchived({
                              variables: {
                                questionIds:
                                  Object.keys(selectedQuestionData).map(Number),
                                isArchived: false,
                              },
                            })
                            setSelectedQuestions({})
                          }}
                        >
                          <FontAwesomeIcon icon={faInbox} />
                        </Button>
                      </Tooltip>
                    </>
                  )}
                </div>
                <Button
                  onClick={() =>
                    setIsQuestionCreationModalOpen(!isQuestionCreationModalOpen)
                  }
                  className={{
                    root: 'h-10 font-bold text-white bg-primary-80',
                  }}
                  data={{ cy: 'create-question' }}
                >
                  {t('manage.questionPool.createQuestionCaps')}
                </Button>
              </div>

              <div className="h-full overflow-y-auto">
                <QuestionList
                  questions={processedQuestions}
                  selectedQuestions={selectedQuestionData}
                  setSelectedQuestions={(id: number, data: Question) => {
                    setSelectedQuestions((prev) => {
                      return { ...prev, [id]: prev[id] ? undefined : data }
                    })
                  }}
                  tagfilter={filters.tags}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {isQuestionCreationModalOpen && (
        <QuestionEditModal
          handleSetIsOpen={setIsQuestionCreationModalOpen}
          isOpen={isQuestionCreationModalOpen}
          mode={QuestionEditModal.Mode.CREATE}
        />
      )}
      <Suspense fallback={<div />}>
        <SuspensedFirstLoginModal />
      </Suspense>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Index
