import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { graphql } from 'react-apollo'
import { intlShape } from 'react-intl'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import QuestionCreationForm from '../../components/forms/QuestionCreationForm'
import { pageWithIntl, withData } from '../../lib'
import { CreateQuestionMutation } from '../../queries/mutations'
import { QuestionListQuery, TagListQuery } from '../../queries/queries'

const propTypes = {
  createQuestion: PropTypes.func.isRequired,
  data: PropTypes.shape({
    tags: PropTypes.array,
  }).isRequired,
  intl: intlShape.isRequired,
}

class CreateQuestion extends Component {
  handleDiscard = () => {
    Router.push('/questions')
  }

  handleSave = ({
    content, options, tags, title, type,
  }) => {
    this.props
      .createQuestion({
        description: content,
        options,
        tags,
        title,
        type,
      })
      .then(() => Router.push('/questions'))
  }

  render() {
    const { data, intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      title: intl.formatMessage({
        defaultMessage: 'Create Question',
        id: 'teacher.createQuestion.title',
      }),
    }

    return (
      <TeacherLayout
        intl={intl}
        navbar={navbarConfig}
        pageTitle={intl.formatMessage({
          defaultMessage: 'Create Question',
          id: 'teacher.createQuestion.pageTitle',
        })}
        sidebar={{ activeItem: 'createQuestion' }}
      >
        <QuestionCreationForm
          intl={intl}
          tags={data.tags}
          onSubmit={this.handleSave}
          onDiscard={this.handleDiscard}
        />
      </TeacherLayout>
    )
  }
}

CreateQuestion.propTypes = propTypes

const withTags = graphql(TagListQuery)

const withCreateQuestionMutation = graphql(CreateQuestionMutation, {
  props: ({ mutate }) => ({
    createQuestion: ({
      description, options, tags, title, type,
    }) =>
      mutate({
        refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
        variables: {
          description,
          options,
          tags,
          title,
          type,
        },
      }),
  }),
})

export default withData(pageWithIntl(withTags(withCreateQuestionMutation(CreateQuestion))))
