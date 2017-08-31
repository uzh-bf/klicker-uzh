// @flow

import React, { Component } from 'react'
import TagsInput from 'react-tagsinput'
import { graphql } from 'react-apollo'
// import RichTextEditor from 'react-rte/lib/RichTextEditor'

import TeacherLayout from '../../components/layouts/TeacherLayout'
import TypeChooser from '../../components/questionTypes/TypeChooser'
import { pageWithIntl, withData } from '../../lib'
import { SCCreationOptions } from '../../components/questionTypes/SC'
import { CreateQuestionMutation } from '../../queries/mutations'

import stylesTagsInput from './styles-tagsinput'

type Props = {
  intl: $IntlShape,
  createQuestion: (string, string, string, string) => Promise<*>,
}

class CreateQuestion extends Component {
  props: Props

  state = {
    activeType: 'SC',
    options: [],
    selectedTags: [],
    title: '',
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

  handleTitleChange = (e) => {
    this.setState({ title: e.target.value })
  }

  handleTagChange = (selectedTags) => {
    this.setState({ selectedTags })
  }

  handleTypeChange = newType => () => {
    this.setState({ activeType: newType })
  }

  handleSave = () => {
    this.props.createQuestion(
      this.state.title,
      'hello world',
      this.state.activeType,
      this.state.selectedTags,
    )
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
        <div className="grid">
          <div className="questionName">
            <h2>Question name</h2>
            <input type="text" value={this.state.title} onChange={this.handleTitleChange} />
          </div>

          <div className="questionType">
            <h2>Question type</h2>
            <TypeChooser
              activeType={this.state.activeType}
              types={[
                { name: 'Single Choice', value: 'SC' },
                { name: 'Multiple Choice', value: 'MC' },
                { name: 'Free-Form', value: 'FREE' },
              ]}
              handleChange={this.handleTypeChange}
            />
          </div>

          <div className="questionTags">
            <h2>Tags</h2>
            <TagsInput value={this.state.selectedTags} onChange={this.handleTagChange} />
          </div>

          <div className="preview">
            <h2>Preview</h2>
            <div className="previewContent">abcd</div>
          </div>

          <div className="content">
            <h2>Content</h2>
            <div>hello world</div>
            {/* <RichTextEditor
              value={RichTextEditor.createEmptyValue()}
              onChange={newValue => console.dir(newValue)}
            /> */}
          </div>

          <div className="answerOptions">
            <h2>Options</h2>
            <SCCreationOptions
              options={this.state.options}
              handleDeleteOption={this.handleDeleteOption}
              handleNewOption={this.handleNewOption}
              handleOptionToggleCorrect={this.handleOptionToggleCorrect}
            />
          </div>

          <button className="discard">Discard</button>
          <button className="save" onClick={this.handleSave}>
            Save
          </button>
        </div>
        <style global jsx>
          {stylesTagsInput}
        </style>
        <style jsx>{`
          @supports (grid-gap: 1rem) {
            .grid {
              display: grid;
              padding: 1rem 0;
              margin: 0 20%;

              grid-gap: 1rem;
              grid-template-columns: repeat(6, 1fr);
              grid-template-rows: auto;
              grid-template-areas: 'name name name name preview preview'
                'type type tags tags preview preview'
                'content content content content content content'
                'options options options options options options';
            }

            h2 {
              grid-row: 1/2;
              grid-column: 1/4;

              margin: 0;
              margin-bottom: 0.5rem;
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

            .questionType > .option {
            }

            .questionTags {
              grid-area: tags;
            }

            .preview {
              grid-area: preview;
            }

            .previewContent {
              border: 1px solid lightgrey;
              padding: 1rem;
              height: 100%;
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

            .answerOptions > .option {
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
        `}</style>
      </TeacherLayout>
    )
  }
}

export default withData(
  pageWithIntl(
    graphql(CreateQuestionMutation, {
      props: ({ mutate }) => ({
        createQuestion: (title, description, type, tags) =>
          mutate({ variables: { title, description, type, tags } }),
      }),
    })(CreateQuestion),
  ),
)
