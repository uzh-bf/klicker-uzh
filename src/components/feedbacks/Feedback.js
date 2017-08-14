// @flow

import React from 'react'
import { Button } from 'semantic-ui-react'

type Props = {
  content: string,
  showDelete: boolean,
  votes: number,
}

const defaultProps = {
  showDelete: true,
}

const Feedback = ({ content, showDelete, votes }: Props) =>
  (<div className="feedback">
    <div className="content">
      {content}
    </div>
    {showDelete &&
      <div className="delete">
        <Button basic icon="trash outline" fluid />
      </div>}

    <div className="votes">
      +{votes}
    </div>

    <style jsx>{`
      .feedback {
        display: flex;

        background: lightgrey;
        border: 1px solid grey;
      }

      .content,
      .delete {
        padding: 1rem;
      }

      .content {
        flex: 1;
      }

      .delete {
        flex: 0 0 1rem;
        align-self: center;
      }

      .votes {
        flex: 0 0 5rem;

        display: flex;
        align-items: center;
        justify-content: center;

        border-left: 1px solid grey;
      }

      @media all and (min-width: 768px) {
        .content,
        .delete {
          padding: .5rem;
        }
      }
    `}</style>
  </div>)

Feedback.defaultProps = defaultProps

export default Feedback
