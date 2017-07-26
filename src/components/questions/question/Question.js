import React from 'react'
import PropTypes from 'prop-types'

import QuestionDetails from './QuestionDetails'
import QuestionTags from './QuestionTags'

import withCSS from '../../../lib/withCSS'

const Question = ({ head, id, lastUsed, tags, title, type, version }) =>
  (<div className="container">
    {head}

    <h2 className="title">
      #{id.substring(0, 7)} - {title} {version > 1 && `(v${version})`}
    </h2>
    <div className="tags">
      <QuestionTags tags={tags} type={type} />
    </div>
    <div className="details">
      <QuestionDetails lastUsed={lastUsed} />
    </div>

    <style jsx>{`
      .container {
        align-items: flex-end;
        display: flex;
        flex-flow: row wrap;
      }

      .title {
        padding: 0;
        font-size: 1.2rem;
        width: 100%;
      }

      .tags {
        width: 100%;
      }

      .details {
        width: 100%;
      }

      @media all and (min-width: 768px) {
        .title {
          width: 75%;
        }
        .tags {
          width: 25%;
        }
      }
    `}</style>
  </div>)

Question.propTypes = {
  head: PropTypes.node.isRequired,
  id: PropTypes.string.isRequired,
  lastUsed: PropTypes.arrayOf(PropTypes.string),
  tags: PropTypes.arrayOf(PropTypes.string),
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['SC', 'MC', 'FREE']).isRequired,
  version: PropTypes.number,
}

Question.defaultProps = {
  lastUsed: [],
  tags: [],
  version: 1,
}

export default withCSS(Question, ['segment'])
