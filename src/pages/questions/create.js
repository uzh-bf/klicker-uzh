// @flow

import React, { Component } from 'react'

import { pageWithIntl, withData } from '../../lib'

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

    return (
      <TeacherLayout
        intl={intl}
        navbar={navbarConfig}
        pageTitle={intl.formatMessage({
          defaultMessage: 'Create Question',
          id: 'teacher.createQuestion.pageTitle',
        })}
        sidebar={{ activeItem: 'questionPool' }}
      >
        <div className="grid">
          <div className="questionName">
            <h2>Question name</h2>
            some input field
          </div>
          <div className="questionType">
            <h2>Question type</h2>
            <div>hello</div>
            <div>helll</div>
            <div>blaaaa</div>
            <div>blaaaa</div>
          </div>
          <div className="preview">item 3</div>
          <div className="content">
            blabla some stuff
          </div>
        </div>

        <style jsx>{`
          @supports (grid-gap: 1rem) {
            .grid {
              display: grid;
              padding: 1rem 0;
              margin: 0 15%;

              grid-gap: 1rem;
              grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
              grid-template-rows: auto;
              grid-template-areas:
                'name name name name preview preview'
                'type type type type preview preview'
                'content content content content content content';
            }

            h2 {
              grid-row: 1;
              grid-column: 1/4;

              border-bottom: 1px solid lightgrey;
              margin: 0;
            }

            .questionName {
              grid-area: name;
            }

            .questionType {
              grid-area: type;

              display: grid;
              grid-gap: 1rem;
              grid-template-columns: 1fr 1fr 1fr;
              grid-template-rows: auto;
            }

            .questionType > div {
              border: 1px solid lightgrey;
              height: 10rem;
            }

            .preview {
              grid-area: preview;

              background-color: red;
            }

            .content {
              grid-area: content;

              background-color: grey;
            }
          }
        `}</style>
      </TeacherLayout>
    )
  }
}

export default withData(pageWithIntl(CreateQuestion))
