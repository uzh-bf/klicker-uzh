import React from 'react'
import { compose, withState } from 'recompose'
import Router from 'next/router'
import { intlShape } from 'react-intl'
import { Query, Mutation } from 'react-apollo'
import { PropTypes } from 'prop-types'
import _pick from 'lodash/pick'
import _omitBy from 'lodash/omitBy'
import _isNil from 'lodash/isNil'

import { TeacherLayout } from '../../components/layouts'
import { QuestionEditForm } from '../../components/forms'
import { pageWithIntl, withData, omitDeep, withDnD, withLogging } from '../../lib'
import {
  TagListQuery,
  QuestionListQuery,
  QuestionDetailsQuery,
  ModifyQuestionMutation,
} from '../../graphql'

const propTypes = {
  intl: intlShape.isRequired,
  url: PropTypes.object.isRequired,
}

const EditQuestion = ({ intl, url }) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage({
        defaultMessage: 'Edit Question',
        id: 'editQuestion.title',
      }),
    }}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Edit Question',
      id: 'editQuestion.pageTitle',
    })}
    sidebar={{ activeItem: 'editQuestion' }}
  >
    <Query query={TagListQuery}>
      {({ data: tagList, loading: tagsLoading }) => (
        <Query query={QuestionDetailsQuery} variables={{ id: url.query.questionId }}>
          {({ data: questionDetails, loading: questionLoading }) => {
            // if the tags or the question is still loading, return null
            if (tagsLoading || questionLoading || !tagList.tags || !questionDetails.question) {
              return null
            }

            // if everything was loaded successfully, render the edit form
            return (
              <Mutation mutation={ModifyQuestionMutation}>
                {(editQuestion, { loading, data, error }) => {
                  const {
 id, tags, title, type, versions,
} = _pick(questionDetails.question, [
                    'id',
                    'tags',
                    'title',
                    'type',
                    'versions',
                  ])

                  // enhance the form with state for the active version
                  const EditForm = withState(
                    'activeVersion',
                    'onActiveVersionChange',
                    versions.length - 1,
                  )(QuestionEditForm)

                  return (
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
                        Router.push('/questions')
                      }}
                      onSubmit={isNewVersion => async ({
                        title: newTitle,
                        description,
                        options,
                        solution,
                        tags: newTags,
                      }) => {
                        await editQuestion({
                          // reload the question details and tags after update
                          // TODO: replace with optimistic updates
                          refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
                          // update the cache after the mutation has completed
                          update: (store, { data: { modifyQuestion } }) => {
                            const query = {
                              query: QuestionDetailsQuery,
                              variables: { id: url.query.questionId },
                            }

                            // get the data from the store
                            // replace the feedbacks
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
                                  description,
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
                            _isNil,
                          ),
                        })
                      }}
                    />
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

export default compose(withLogging(), withDnD, withData, pageWithIntl)(EditQuestion)
