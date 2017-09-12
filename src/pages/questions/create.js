// TODO: reenable flow
// semantic: button, form, input

// import type { OperationComponent } from 'react-apollo'

import React, { Component } from 'react'
import Router from 'next/router'
import { graphql } from 'react-apollo'
import { Helmet } from 'react-helmet'

import QuestionCreationForm from '../../components/forms/QuestionCreationForm'
import TeacherLayout from '../../components/layouts/TeacherLayout'
import { createLinks, pageWithIntl, withData } from '../../lib'

import { CreateQuestionMutation } from '../../queries/mutations'
import { QuestionListQuery, TagListQuery } from '../../queries/queries'

import stylesTagsInput from './styles-tagsinput'

/* type Props = {
  intl: $IntlShape,
  createQuestion: ({
    description: ?string,
    options: Array<{
      correct: boolean,
      name: string,
    }>,
    tags: Array<string>,
    title: ?string,
    type: string,
  }) => Promise<*>,
} */

class CreateQuestion extends Component {
  // props: Props

  handleSave = ({ content, options, tags, title, type }) => {
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
        <Helmet defer={false}>{createLinks(['button', 'form'])}</Helmet>
        <QuestionCreationForm intl={intl} tags={data.tags} onSubmit={this.handleSave} />
      </TeacherLayout>
    )
  }
}

const withTags = graphql(TagListQuery)

const withMutation = graphql(CreateQuestionMutation, {
  props: ({ mutate }) => ({
    createQuestion: ({ description, options, tags, title, type }) =>
      mutate({
        refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
        variables: { description, options, tags, title, type },
      }),
  }),
})

export default withData(pageWithIntl(withTags(withMutation(CreateQuestion))))
