import React from 'react'
import { compose, branch, renderNothing, withProps, withHandlers, withState } from 'recompose'
import Router from 'next/router'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import { PropTypes } from 'prop-types'
import _pick from 'lodash/pick'
import _omitBy from 'lodash/omitBy'
import _isNil from 'lodash/isNil'

import { TeacherLayout } from '../../components/layouts'
import { QuestionEditForm } from '../../components/forms'
import { pageWithIntl, withData, omitDeep, withDnD, withLogging } from '../../lib'
import {
  TagListQuery,
  QuestionPoolQuery,
  QuestionDetailsQuery,
  ModifyQuestionMutation,
} from '../../graphql'

const propTypes = {
  activeVersion: PropTypes.number.isRequired,
  allTags: PropTypes.array.isRequired,
  handleDiscard: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  isNewVersion: PropTypes.bool.isRequired,
  questionTags: PropTypes.array.isRequired,
  setActiveVersion: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  versions: PropTypes.array.isRequired,
}

const EditQuestion = ({
  allTags,
  intl,
  isNewVersion,
  questionTags,
  title,
  type,
  versions,
  handleDiscard,
  handleSave,
  activeVersion,
  setActiveVersion,
}) => (
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
    <QuestionEditForm
      activeVersion={activeVersion}
      allTags={allTags}
      intl={intl}
      isNewVersion={isNewVersion}
      questionTags={questionTags}
      title={title}
      type={type}
      versions={versions}
      onActiveVersionChange={setActiveVersion}
      onDiscard={handleDiscard}
      onSubmit={handleSave}
    />
  </TeacherLayout>
)

EditQuestion.propTypes = propTypes

export default compose(
  withLogging(),
  withDnD,
  withData,
  pageWithIntl,
  graphql(TagListQuery, { name: 'tags' }),
  graphql(QuestionDetailsQuery, {
    name: 'details',
    options: ({ url }) => ({ variables: { id: url.query.questionId } }),
  }),
  branch(
    ({ details, tags }) => details.loading || tags.loading || !details.question,
    renderNothing,
  ),
  graphql(ModifyQuestionMutation),
  withState(
    'activeVersion',
    'setActiveVersion',
    ({ details }) => details.question.versions.length - 1,
  ),
  withProps(({ activeVersion, details, tags }) => ({
    ..._pick(details.question, ['id', 'title', 'type', 'versions']),
    allTags: tags.tags,
    isNewVersion: activeVersion === details.question.versions.length,
    questionTags: details.question.tags,
  })),
  withHandlers({
    // handle discarding question modification
    handleDiscard: () => () => {
      Router.push('/questions')
    },

    // handle modifying a question
    handleSave: ({
      id, mutate, isNewVersion, url,
    }) => async ({
      title,
      description,
      options,
      solution,
      tags,
    }) => {
      try {
        await mutate({
          // reload the question details and tags after update
          // TODO: replace with optimistic updates
          refetchQueries: [{ query: QuestionPoolQuery }],
          // update the cache after the mutation has completed
          update: (store, { data: { modifyQuestion } }) => {
            const query = {
              query: QuestionDetailsQuery,
              variables: { id: url.query.questionId },
            }

            // get the data from the store
            // replace the feedbacks
            const data = store.readQuery(query)

            data.question.title = modifyQuestion.title
            data.question.versions = modifyQuestion.versions
            data.question.tags = modifyQuestion.tags

            // write the updated data to the store
            store.writeQuery({
              ...query,
              data,
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
                options: omitDeep(options, '__typename'),
                solution,
                tags,
                title,
              }
              : {
                id,
                tags,
                title,
              },
            _isNil,
          ),
        })
      } catch ({ message }) {
        console.error(message)
      }
    },
  }),
)(EditQuestion)
