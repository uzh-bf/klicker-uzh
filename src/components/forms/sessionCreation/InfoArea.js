import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Message, Divider } from 'semantic-ui-react'

export default () => (
  <div className="infoArea">
    <Message info>
      <FormattedMessage
        defaultMessage="Group questions inside a block to activate and evaluate them simultaneously."
        id="sessionCreation.blockGrouping"
      />
      <Divider />
      <FormattedMessage
        defaultMessage="Create multiple blocks to evaluate questions sequentially."
        id="sessionCreation.blockSequence"
      />
      <Divider />
      <FormattedMessage
        defaultMessage="Drag & drop a question onto the grey dropzone to begin."
        id="sessionCreation.emptyDropzoneInfo"
      />
    </Message>
    <style jsx>{`
      .infoArea {
        padding: 0.5rem 1rem;
        width: 350px;

        :global(.divider) {
          margin: 0.5rem 0;
        }
      }
    `}</style>
  </div>
)
