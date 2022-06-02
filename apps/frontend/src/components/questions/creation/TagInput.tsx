import React, { useState } from 'react'
import { Dropdown, Form, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import SemanticCustomTooltip from '../../common/SemanticCustomTooltip'

interface Props {
  disabled?: boolean
  error?: string
  onChange: any
  tags?: {
    id: string
    name: string
  }[]
  touched: boolean
  value?: any[]
}

const defaultProps = {
  disabled: false,
  error: null,
  tags: [],
  value: [],
}

function TagInput({ tags, value, onChange, error, touched, disabled }: Props): React.ReactElement {
  const [tagState, setTagState] = useState(tags.map(({ id, name }): any => ({ key: id, text: name, value: name })))

  const onAddNewTag = (_, { value: newTagValue }): void => {
    if (tagState.map(({ text }): string => text).includes(newTagValue)) {
      return
    }

    setTagState([...tagState, { key: newTagValue, text: newTagValue, value: newTagValue }])
  }

  return (
    <div className="tagInput">
      <Form.Field required error={touched && error}>
        <label htmlFor="tags">
          <FormattedMessage defaultMessage="Tags" id="createQuestion.tagInput.label" />

          <SemanticCustomTooltip
            className={'!ml-2'}
            content={
              <FormattedMessage
                defaultMessage="Add tags to your question to improve organization and reusability (similar to the folders used previously)."
                id="createQuestion.tagInput.tooltip"
              />
            }
            trigger={
              <a data-tip>
                <Icon name="question circle" />
              </a>
            }
          />
        </label>

        <Dropdown
          allowAdditions
          fluid
          multiple
          search
          selection
          disabled={disabled}
          options={tagState}
          value={value}
          onAddItem={onAddNewTag}
          onChange={(_, { value: newVal }): void => onChange(newVal)}
        />
      </Form.Field>

      <style jsx>{`
        @import 'src/theme';

        .tagInput {
          > :global(.field) {
            @include tooltip-icon;
          }

          :global(.error .react-tagsinput) {
            background-color: $color-error-bg;
            border-color: $color-error-border;
          }
        }
      `}</style>
    </div>
  )
}

TagInput.defaultProps = defaultProps

export default TagInput
