import React from 'react'
import { compose, withState } from 'recompose'
import { withRouter } from 'next/router'
import { convertToRaw } from 'draft-js'
import { defineMessages, intlShape } from 'react-intl'
import { Query, Mutation } from 'react-apollo'
import { PropTypes } from 'prop-types'
import _pick from 'lodash/pick'
import _omitBy from 'lodash/omitBy'
import _isNil from 'lodash/isNil'

import { TeacherLayout } from '../../components/layouts'
import { QuestionEditForm } from '../../components/forms'
import {
  pageWithIntl,
  omitDeep,
  omitDeepArray,
  withDnD,
  withLogging,
  getPresignedURLs,
  uploadFilesToPresignedURLs,
} from '../../lib'
import {
  TagListQuery,
  QuestionListQuery,
  QuestionDetailsQuery,
  ModifyQuestionMutation,
  RequestPresignedURLMutation,
} from '../../graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Edit Question',
    id: 'editQuestion.pageTitle',
  },
  title: {
    defaultMessage: 'Edit Question',
    id: 'editQuestion.title',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
  router: PropTypes.object.isRequired,
}

const EditQuestion = ({ intl, router }) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage(messages.title),
    }}
    pageTitle={intl.formatMessage(messages.pageTitle)}
    sidebar={{ activeItem: 'editQuestion' }}
  >
    <Query query={TagListQuery}>
      {({ data: tagList, loading: tagsLoading }) => (
        <Query query={QuestionDetailsQuery} variables={{ id: router.query.questionId }}>
          {({ data: questionDetails, loading: questionLoading }) => {
            // if the tags or the question is still loading, return null
            if (tagsLoading || questionLoading || !tagList.tags || !questionDetails.question) {
              return null
            }

            // if everything was loaded successfully, render the edit form
            return (
              <Mutation mutation={ModifyQuestionMutation}>
                {(editQuestion, { loading, data, error }) => {
                  const { id, tags, title, type, versions } = _pick(questionDetails.question, [
                    'id',
                    'tags',
                    'title',
                    'type',
                    'versions',
                  ])

                  // enhance the form with state for the active version
                  const EditForm = withState('activeVersion', 'onActiveVersionChange', versions.length)(
                    QuestionEditForm
                  )

                  return (
                    <Mutation mutation={RequestPresignedURLMutation}>
                      {requestPresignedURL => (
                        <EditForm
                          allTags={tagList.tags}
                          editSuccess={{
                            message: (error && error.message) || null,
                            success: (data && !error) || null,
                          }}
                          intl={intl}
                          loading={loading}
                          questionTags={tags}
                          title={title}
                          type={type}
                          versions={versions}
                          onDiscard={() => {
                            router.push('/questions')
                          }}
                          onSubmit={isNewVersion => async (
                            { title: newTitle, content, options, solution, tags: newTags, files },
                            { setSubmitting }
                          ) => {
                            // split files into newly added and existing entities
                            const existingFiles = files.filter(file => file.id)
                            const newFiles = files.filter(file => file.preview)

                            // request presigned urls and filenames for newly added files
                            const fileEntities = await getPresignedURLs(newFiles, requestPresignedURL)

                            // upload (put) the new files to the corresponding presigned urls
                            await uploadFilesToPresignedURLs(fileEntities)

                            // combine existing files and newly uploaded files into a single array
                            const allFiles = existingFiles.concat(
                              fileEntities.map(({ id: fileId, file, fileName }) => ({
                                id: fileId,
                                name: fileName,
                                originalName: file.name,
                                type: file.type,
                              }))
                            )

                            // modify the question
                            await editQuestion({
                              // reload the question details and tags after update
                              // TODO: replace with optimistic updates
                              refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
                              // update the cache after the mutation has completed
                              update: (store, { data: { modifyQuestion } }) => {
                                const query = {
                                  query: QuestionDetailsQuery,
                                  variables: { id: router.query.questionId },
                                }

                                // get the data from the store
                                const cache = store.readQuery(query)

                                cache.question.title = modifyQuestion.title
                                cache.question.versions = modifyQuestion.versions
                                cache.question.tags = modifyQuestion.tags

                                // write the updated data to the store
                                store.writeQuery({
                                  ...query,
                                  data: cache,
                                })
                              },
                              variables: _omitBy(
                                isNewVersion
                                  ? {
                                      content: JSON.stringify(convertToRaw(content.getCurrentContent())),
                                      files: omitDeepArray(allFiles, '__typename'),
                                      id,
                                      // HACK: omitDeep for typename removal
                                      // TODO: check https://github.com/apollographql/apollo-client/issues/1564
                                      // this shouldn't be necessary at all
                                      options: options && omitDeep(options, '__typename'),
                                      solution,
                                      tags: newTags,
                                      title: newTitle,
                                    }
                                  : {
                                      id,
                                      tags: newTags,
                                      title: newTitle,
                                    },
                                _isNil
                              ),
                            })

                            setSubmitting(false)
                          }}
                        />
                      )}
                    </Mutation>
                  )
                }}
              </Mutation>
            )
          }}
        </Query>
      )}
    </Query>
  </TeacherLayout>
)

EditQuestion.propTypes = propTypes

export default compose(
  withRouter,
  withLogging({
    slaask: true,
  }),
  withDnD,
  pageWithIntl
)(EditQuestion)
