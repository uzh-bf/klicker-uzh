// @flow

import React, { Component } from 'react'
// import RichTextEditor from 'react-rte/lib/RichTextEditor'

import { pageWithIntl, withData } from '../../lib'

import { SCCreationOptions } from '../../components/questionTypes/SC'

import TeacherLayout from '../../components/layouts/TeacherLayout'

class CreateQuestion extends Component {
  props: {
    intl: $IntlShape,
  }

  state = {}

  render() {
    const { intl } = this.props

    const navbarConfig = {
      accountShort: 'AW',
      title: intl.formatMessage({
        defaultMessage: 'Create Question',
        id: 'teacher.createQuestion.title',
      }),
    }

    const options = [
      {correct: false, name: 'Hello world'},
      {correct: true, name: 'This is so true'}
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
        <div className="grid">
          <div className="questionName">
            <h2>Question name</h2>
            <input />
          </div>
          <div className="questionType">
            <h2>Question type</h2>
            <div className="option">Single-Choice</div>
            <div className="option">Multiple-Choice</div>
          </div>
          <div className="questionTags">
            <h2>Tags</h2>
            <div className="tag">CAPM</div>
            <div className="tag">AABCD</div>
            <input />
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
            <SCCreationOptions options={options} />
          </div>
        </div>

        <style jsx>{`
          @supports (grid-gap: 1rem) {
            .grid {
              display: grid;
              padding: 1rem 0;
              margin: 0 20%;

              grid-gap: 1rem;
              grid-template-columns: repeat(7, 1fr);
              grid-template-rows: auto;
              grid-template-areas: 'name name name name . preview preview'
                'type type tags tags . preview preview'
                'content content content content content content content'
                'options options options options options options options';
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
          }
        `}</style>
      </TeacherLayout>
    )
  }
}

export default withData(pageWithIntl(CreateQuestion))
