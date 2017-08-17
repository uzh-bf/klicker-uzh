// @flow

import * as React from 'react';

type Props = {
  tags: Array<string>,
  type: string,
}

const QuestionTags = ({ tags, type }: Props) =>
  (<div className="container">
    <div className="type tag">
      {type}
    </div>
    {tags.map(tag =>
      (<div key={tag} className="tag">
        {tag}
      </div>),
    )}

    <style jsx>{`
      .container {
        display: flex;
        flex-flow: row wrap;
      }
      .tag {
        background-color: lightgrey;
        padding: 0.3rem 0.5rem;
        flex: 1;
        text-align: center;
      }
      .type {
        font-weight: bold;
      }

      @media all and (min-width: 768px) {
        .container {
          align-items: flex-end;
          flex-flow: row nowrap;
          justify-content: flex-end;
        }
        .tag {
          background: none;
          border-left: solid 1px;
          border-top: 1px solid grey;
          padding: 0.5rem 1rem;
          flex: 0 1 auto;
        }
        .tag:last-child {
          border-right: solid 1px;
        }
      }
    `}</style>
  </div>)

export default QuestionTags
