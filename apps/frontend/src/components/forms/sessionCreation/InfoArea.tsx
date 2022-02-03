import React from 'react'
import { FormattedMessage } from 'react-intl'
import { Message, Divider } from 'semantic-ui-react'

function InfoArea(): React.ReactElement {
  return (
    <div className="infoArea py-2 px-4 w-[350px]">
      <Message info className="!block">
        <FormattedMessage
          defaultMessage="Group questions inside a block to activate and evaluate them simultaneously."
          id="sessionCreation.blockGrouping"
        />
        <Divider className="!mx-0 !my-2" />
        <FormattedMessage
          defaultMessage="Create multiple blocks to evaluate questions sequentially."
          id="sessionCreation.blockSequence"
        />
        <Divider className="!mx-0 !my-2" />
        <FormattedMessage
          defaultMessage="Drag & drop a question onto the grey plus sign to begin."
          id="sessionCreation.emptyDropzoneInfo"
        />
      </Message>
    </div>
  )
}

export default InfoArea
