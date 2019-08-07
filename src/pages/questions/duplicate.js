import React from 'react'
import { compose } from 'recompose'
import { Query, Mutation } from 'react-apollo'
import { defineMessages } from 'react-intl'
import { ContentState, convertFromRaw, convertToRaw, EditorState } from 'draft-js'
import { PropTypes } from 'prop-types'
import Router, { withRouter } from 'next/router'
import _pick from 'lodash/pick'
import _omitBy from 'lodash/omitBy'
import _isNil from 'lodash/isNil'

import { TeacherLayout } from '../../components/layouts'
import { QuestionCreationForm } from '../../components/forms'
import {
  pageWithIntl,
  withDnD,
  withLogging,
  getPresignedURLs,
  uploadFilesToPresignedURLs,
  omitDeepArray,
  omitDeep,
} from '../../lib'
import {
  QuestionListQuery,
  TagListQuery,
  CreateQuestionMutation,
  RequestPresignedURLMutation,
  QuestionDetailsQuery,
} from '../../graphql'
import { QUESTION_TYPES } from '../../constants'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Duplicate Question',
    id: 'duplicateQuestion.pageTitle',
  },
  title: {
    defaultMessage: 'Duplicate Question',
    id: 'duplicateQuestion.title',
  },
})

const propTypes = {
  router: PropTypes.object.isRequired,
}

const DuplicateQuestion = ({ intl, router }) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage(messages.title),
    }}
    pageTitle={intl.formatMessage(messages.pageTitle)}
    sidebar={{ activeItem: 'createQuestion' }}
  >
    <Query query={TagListQuery}>
      {({ data: tagList, loading: tagsLoading }) => (
        <Query query={QuestionDetailsQuery} variables={{ id: router.query.questionId }}>
          {({ data: questionDetails, loading: questionLoading }) => {
            if (tagsLoading || questionLoading || !tagList.tags || !questionDetails.question) {
              return null
            }
            const { tags, title, type, versions } = _pick(questionDetails.question, [
              'tags',
              'title',
              'type',
              'versions',
            ])

            const duplicateTitle = '(Duplicate)'

            // When duplicating, duplicate newest version of the question
            const initializeVersion = versions.length - 1

            // Depending on original question type, populate newly created question instance
            // with missing fields.
            const prepForm = versions
            switch (type) {
              case QUESTION_TYPES.FREE:
                prepForm[initializeVersion].options = []
                prepForm[initializeVersion].options[type] = {
                  choices: [],
                  randomized: false,
                  restrictions: {
                    max: null,
                    min: null,
                  },
                }
                break
              case QUESTION_TYPES.FREE_RANGE:
                prepForm[initializeVersion].options[type].choices = []
                prepForm[initializeVersion].options[type].randomized = false
                break
              case QUESTION_TYPES.MC:
                prepForm[initializeVersion].options[type].randomized = false
                break
              case QUESTION_TYPES.SC:
                prepForm[initializeVersion].options[type].randomized = false
                break
              default:
                break
            }

            const initialValues = {
              content: prepForm[initializeVersion].content
                ? EditorState.createWithContent(convertFromRaw(JSON.parse(prepForm[initializeVersion].content)))
                : EditorState.createWithContent(ContentState.createFromText(prepForm[initializeVersion].description)),
              files: prepForm[initializeVersion].files || [],
              options: prepForm[initializeVersion].options[type] || {},
              tags: tags.map(tag => tag.name),
              title: title + duplicateTitle,
              type,
              versions: prepForm,
            }

            // const DuplicationForm = withState(versions.length)(QuestionCreationForm)
            return (
              <Mutation mutation={CreateQuestionMutation}>
                {(createQuestion, { loading }) => (
                  <Mutation mutation={RequestPresignedURLMutation}>
                    {requestPresignedURL => (
                      <QuestionCreationForm
                        initialValues={initialValues}
                        intl={intl}
                        loading={loading}
                        tags={tagList.tags}
                        title={title}
                        type={type}
                        versions={versions}
                        // handle discarding a new question
                        onDiscard={() => Router.push('/questions')}
                        // handle submitting a new question
                        onSubmit={async (
                          // eslint-disable-next-line no-shadow
                          { content, options, tags, title, type, files, solution },
                          { setSubmitting }
                        ) => {
                          // request presigned urls and filenames for all files
                          const fileEntities = await getPresignedURLs(files, requestPresignedURL)
                          const existingFiles = files.filter(file => file.id)
                          // upload (put) the files to the corresponding presigned urls
                          await uploadFilesToPresignedURLs(fileEntities)

                          // combine existing files and newly uploaded files into a single array
                          const allFiles = existingFiles.concat(
                            fileEntities.map(({ id: fileId, file, fileName }) => ({
                              id: fileId,
                              name: fileName,
                              type: file.type,
                            }))
                          )
                          // create the question
                          await createQuestion({
                            refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
                            variables: _omitBy(
                              {
                                content: JSON.stringify(convertToRaw(content.getCurrentContent())),
                                files: omitDeepArray(allFiles, '__typename'),
                                // HACK: omitDeep for typename removal
                                // TODO: check https://github.com/apollographql/apollo-client/issues/1564
                                // this shouldn't be necessary at all
                                options: options && omitDeep(options, '__typename'),
                                solution,
                                tags,
                                title,
                                type,
                              },
                              _isNil
                            ),
                          })
                          setSubmitting(false)

                          Router.push('/questions')
                        }}
                      />
                    )}
                  </Mutation>
                )}
              </Mutation>
            )
          }}
        </Query>
      )}
    </Query>
  </TeacherLayout>
)

DuplicateQuestion.propTypes = propTypes

export default compose(
  withRouter,
  withLogging({
    slaask: true,
  }),
  withDnD,
  pageWithIntl
)(DuplicateQuestion)
