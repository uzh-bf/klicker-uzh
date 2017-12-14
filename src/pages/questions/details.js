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
import { pageWithIntl, withData, omitDeep } from '../../lib'
import {
  QuestionListQuery,
  QuestionDetailsQuery,
  TagListQuery,
  ModifyQuestionMutation,
} from '../../graphql'

const propTypes = {
  activeVersion: PropTypes.number.isRequired,
  handleDiscard: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  isNewVersion: PropTypes.bool.isRequired,
  setActiveVersion: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf().isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  versions: PropTypes.arrayOf().isRequired,
}

const EditQuestion = ({
  intl,
  isNewVersion,
  tags,
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
        id: 'teacher.editQuestion.title',
      }),
    }}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Edit Question',
      id: 'teacher.editQuestion.pageTitle',
    })}
    sidebar={{ activeItem: 'editQuestion' }}
  >
    <QuestionEditForm
      activeVersion={activeVersion}
      intl={intl}
      isNewVersion={isNewVersion}
      tags={tags.map(tag => tag.name)}
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
  withData,
  pageWithIntl,
  graphql(QuestionDetailsQuery, {
    options: ({ url }) => ({ variables: { id: url.query.questionId } }),
  }),
  branch(({ data }) => data.loading || !data.question, renderNothing),
  graphql(ModifyQuestionMutation),
  withState('activeVersion', 'setActiveVersion', ({ data }) => data.question.versions.length - 1),
  withProps(({ activeVersion, data }) => ({
    ..._pick(data.question, ['id', 'title', 'type', 'tags', 'versions']),
    isNewVersion: activeVersion === data.question.versions.length,
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
          refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
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
