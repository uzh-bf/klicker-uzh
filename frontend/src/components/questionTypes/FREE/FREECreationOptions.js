import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash/get'
import ReactTooltip from 'react-tooltip'
import { Form, Input } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'
import { compose, withHandlers, mapProps } from 'recompose'

import { QUESTION_TYPES } from '../../../constants'

const propTypes = {
  handleMaxChange: PropTypes.func.isRequired,
  handleMinChange: PropTypes.func.isRequired,
  max: PropTypes.number,
  meta: PropTypes.shape({
    dirty: PropTypes.bool,
    invalid: PropTypes.bool,
  }).isRequired,
  min: PropTypes.number,
  type: PropTypes.string.isRequired,
}

const defaultProps = {
  max: undefined,
  min: undefined,
}

const FREECreationOptions = ({
  max,
  min,
  type,
  handleMaxChange,
  handleMinChange,
  meta: { dirty, invalid },
}) => (
  <div className="FREECreationOptions">
    <Form.Field required error={dirty && invalid}>
      <label htmlFor="options">
        <FormattedMessage
          defaultMessage="Input Restrictions"
          id="teacher.createQuestion.optionsFREE.label"
        />
        <a data-tip data-for="FREECreationHelp">
          <FaQuestionCircle />
        </a>
      </label>

      <ReactTooltip delayHide={250} delayShow={250} id="FREECreationHelp" place="right">
        <FormattedMessage
          defaultMessage="Choose the allowed format of incoming responses."
          id="teacher.createQuestion.optionsFREE.tooltip"
        />
      </ReactTooltip>

      {type === QUESTION_TYPES.FREE && <div>Unrestricted input.</div>}

      {type === QUESTION_TYPES.FREE_RANGE && (
        <div className="range">
          <Form.Field>
            <label htmlFor="min">
              <FormattedMessage defaultMessage="Min" id="teacher.createQuestion.options.min" />
            </label>
            <Input
              name="min"
              placeholder="-∞"
              type="number"
              value={min}
              onChange={handleMinChange}
            />
          </Form.Field>

          <Form.Field>
            <label htmlFor="max">
              <FormattedMessage defaultMessage="Max" id="teacher.createQuestion.options.max" />
            </label>
            <Input
              name="max"
              placeholder="∞"
              type="number"
              value={max}
              onChange={handleMaxChange}
            />
          </Form.Field>
        </div>
      )}
    </Form.Field>

    <style jsx>{`
      @import 'src/theme';

      .FREECreationOptions {
        @include tooltip-icon;

        .optionsChooser {
          display: flex;

          > :global(*):not(:last-child) {
            margin-right: 1rem;
          }
        }

        .range {
          display: flex;
          flex-direction: column;

          margin-top: 1rem;

          :global(.field) > label {
            font-size: 1rem;
          }

          @include desktop-tablet-only {
            flex-direction: row;

            :global(.field) {
              width: 10rem;

              &:not(:last-child) {
                margin-right: 1rem;
              }
            }
          }
        }
      }
    `}</style>
  </div>
)

FREECreationOptions.propTypes = propTypes
FREECreationOptions.defaultProps = defaultProps

export default compose(
  mapProps(({ input: { onChange, value }, meta, type }) => ({
    max: _get(value, 'restrictions.max'),
    meta,
    min: _get(value, 'restrictions.min'),
    onChange,
    type,
    value,
  })),
  withHandlers({
    // handle a change in the maximum allowed numerical value
    handleMaxChange: ({ onChange, value }) => (e) => {
      const max = e.target.value === '' ? null : +e.target.value
      onChange({
        ...value,
        restrictions: { ...value.restrictions, max },
      })
    },

    // handle a change in the minimum allowed numerical value
    handleMinChange: ({ onChange, value }) => (e) => {
      const min = e.target.value === '' ? null : +e.target.value
      onChange({
        ...value,
        restrictions: { ...value.restrictions, min },
      })
    },
  }),
)(FREECreationOptions)
