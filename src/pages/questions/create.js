// @flow
// semantic: button, form, input

import React, { Component } from 'react'
import TagsInput from 'react-tagsinput'
import Router from 'next/router'
import { graphql } from 'react-apollo'
import { FormattedMessage } from 'react-intl'
import { Helmet } from 'react-helmet'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import TypeChooser from '../../components/questionTypes/TypeChooser'
import { createLinks, pageWithIntl, withData } from '../../lib'
import { SCCreationOptions } from '../../components/questionTypes/SC'
import { CreateQuestionMutation } from '../../queries/mutations'
import { QuestionListQuery, TagListQuery } from '../../queries/queries'

import stylesTagsInput from './styles-tagsinput'

type Props = {
  intl: $IntlShape,
  createQuestion: (string, string, string, Array<string>) => Promise<*>,
}

class CreateQuestion extends Component {
  props: Props

  state = {
    activeType: 'SC',
    content: '',
    options: [],
    selectedTags: [],
    title: '',
  }

  handleUpdateOrder = (options) => {
    this.setState({ options })
  }

  handleNewOption = (option) => {
    this.setState({ options: [...this.state.options, option] })
  }

  handleDeleteOption = index => () => {
    this.setState({
      options: [...this.state.options.slice(0, index), ...this.state.options.slice(index + 1)],
    })
  }

  handleOptionToggleCorrect = index => () => {
    const option = this.state.options[index]

    this.setState({
      options: [
        ...this.state.options.slice(0, index),
        { ...option, correct: !option.correct },
        ...this.state.options.slice(index + 1),
      ],
    })
  }

  handleContentChange = (e) => {
    this.setState({ content: e.target.value })
  }

  handleTitleChange = (e) => {
    this.setState({ title: e.target.value })
  }

  handleTagChange = (selectedTags) => {
    this.setState({ selectedTags })
  }

  handleTypeChange = newType => () => {
    this.setState({ activeType: newType })
  }

  handleSave = (e) => {
    e.preventDefault()

    this.props
      .createQuestion({
        description: 'hello world',
        options: this.state.options,
        tags: this.state.selectedTags,
        title: this.state.title,
        type: this.state.activeType,
      })
      .then(() => Router.push('/questions'))
  }

  render() {
    const { intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      title: intl.formatMessage({
        defaultMessage: 'Create Question',
        id: 'teacher.createQuestion.title',
      }),
    }

    const types = [
      {
        name: intl.formatMessage({
          defaultMessage: 'Single-Choice',
          id: 'common.questionTypes.sc',
        }),
        value: 'SC',
      },
      {
        name: intl.formatMessage({
          defaultMessage: 'Multiple-Choice',
          id: 'common.questionTypes.mc',
        }),
        value: 'MC',
      },
      {
        name: intl.formatMessage({
          defaultMessage: 'Free-Form',
          id: 'common.questionTypes.free',
        }),
        value: 'FREE',
      },
    ]

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

        <form className="ui form" onSubmit={this.handleSave}>
          <div className="field questionName">
            <label htmlFor="questionName">
              <FormattedMessage
                defaultMessage="Question name"
                id="teacher.createQuestion.questionName"
              />
            </label>
            <input
              name="questionName"
              type="text"
              value={this.state.title}
              onChange={this.handleTitleChange}
            />
          </div>

          <div className="field questionType">
            <label htmlFor="types">
              <FormattedMessage
                defaultMessage="Question type"
                id="teacher.createQuestion.questionType"
              />
            </label>
            <TypeChooser
              name="types"
              activeType={this.state.activeType}
              types={types}
              handleChange={this.handleTypeChange}
            />
          </div>

          <div className="field questionTags">
            <label htmlFor="tags">
              <FormattedMessage defaultMessage="Tags" id="teacher.createQuestion.tags" />
            </label>
            <TagsInput
              name="tags"
              value={this.state.selectedTags}
              onChange={this.handleTagChange}
            />
          </div>

          <div className="field content">
            <label htmlFor="content">
              <FormattedMessage defaultMessage="Content" id="teacher.createQuestion.content" />
            </label>
            <textarea
              name="content"
              value={this.state.content}
              onChange={this.handleContentChange}
            />
          </div>

          <div className="field answerOptions">
            <label htmlFor="options">
              <FormattedMessage defaultMessage="Options" id="teacher.createQuestion.options" />
            </label>
            <SCCreationOptions
              name="options"
              options={this.state.options}
              handleUpdateOrder={this.handleUpdateOrder}
              handleDeleteOption={this.handleDeleteOption}
              handleNewOption={this.handleNewOption}
              handleOptionToggleCorrect={this.handleOptionToggleCorrect}
            />
          </div>

          <div className="preview">this would be a preview</div>

          <button
            className="ui button discard"
            type="reset"
            onClick={() => Router.push('/questions')}
          >
            <FormattedMessage defaultMessage="Discard" id="teacher.createQuestion.button.discard" />
          </button>
          <button className="ui primary button save" type="submit">
            <FormattedMessage defaultMessage="Save" id="common.button.save" />
          </button>
        </form>

        <style global jsx>
          {stylesTagsInput}
        </style>
        <style jsx>{`
          form {
            display: flex;
            flex-direction: column;

            padding: 1rem;
          }

          .field > label {
            font-size: 1.2rem;
          }

          @supports (grid-gap: 1rem) {
            @media all and (min-width: 768px) {
              form {
                display: grid;

                grid-gap: 1rem;
                grid-template-columns: repeat(6, 1fr);
                grid-template-rows: auto;
                grid-template-areas: 'name name name name preview preview'
                  'type type tags tags preview preview'
                  'content content content content content content'
                  'options options options options options options';
              }

              form > .field {
                margin-bottom: 0;
              }

              input {
                width: 100%;
              }

              .option {
                border: 1px solid lightgrey;
                padding: 1rem;
              }

              .option:hover {
                border: 1px solid blue;
                cursor: pointer;
              }

              .option:not(:last-child) {
                margin-bottom: 0.5rem;
              }

              .questionName {
                grid-area: name;
              }

              .questionType {
                grid-area: type;
              }

              .questionTags {
                grid-area: tags;
              }

              .preview {
                grid-area: preview;

                border: 1px solid lightgrey;
                padding: 1rem;
              }

              .content {
                grid-area: content;
              }

              .content > div {
                border: 1px solid lightgrey;
                height: 20rem;
                padding: 1rem;
              }

              .answerOptions {
                grid-area: options;
              }

              .answerOptions > .option.placeholder {
                background-color: lightgrey;
                border-color: grey;
                text-align: center;
              }

              .save {
                align-self: center;
              }
            }

            @media all and (min-width: 991px) {
              form {
                margin: 0 20%;
                padding: 1rem 0;
              }
            }
          }
        `}</style>
      </TeacherLayout>
    )
  }
}

export default withData(
  pageWithIntl(
    graphql(CreateQuestionMutation, {
      props: ({ mutate }) => ({
        createQuestion: ({ description, options, tags, title, type }) =>
          mutate({
            refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
            variables: { description, options, tags, title, type },
          }),
      }),
    })(CreateQuestion),
  ),
)
