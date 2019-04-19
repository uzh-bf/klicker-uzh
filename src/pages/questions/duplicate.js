import React from 'react'
import { compose, withState } from 'recompose'
import { Query, Mutation } from 'react-apollo'
import { defineMessages, intlShape } from 'react-intl'
import { convertToRaw } from 'draft-js'
import { PropTypes } from 'prop-types'
import Router, { withRouter } from 'next/router'
import _pick from 'lodash/pick'
import _omitBy from 'lodash/omitBy'
import _isNil from 'lodash/isNil'

import { TeacherLayout } from '../../components/layouts'
import { QuestionDuplicationForm } from '../../components/forms'
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
  intl: intlShape.isRequired,
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
            const DuplicationForm = withState(versions.length)(QuestionDuplicationForm)
            return (
              <Mutation mutation={CreateQuestionMutation}>
                {(createQuestion, { loading }) => (
                  <Mutation mutation={RequestPresignedURLMutation}>
                    {requestPresignedURL => (
                      <DuplicationForm
                        allTags={tagList.tags}
                        intl={intl}
                        loading={loading}
                        questionTags={tags}
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
