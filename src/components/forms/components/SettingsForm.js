import React from 'react'
import PropTypes from 'prop-types'
import { Button, Divider, Form } from 'semantic-ui-react'

const propTypes = {
  button: PropTypes.shape({
    invalid: PropTypes.bool.isRequired,
    label: PropTypes.string.isRequired,
    onSubmit: PropTypes.func.isRequired,
  }).isRequired,
  children: PropTypes.node.isRequired,
  sectionTitle: PropTypes.string.isRequired,
}

const SettingsForm = ({ button, children, sectionTitle }) => (
  <div className="settingsForm">
    <Form error>
      <h2>{sectionTitle}</h2>
      <Divider />

      {children}

      <div className="actionArea">
        <Button
          primary
          className="semanticButton"
          disabled={button.invalid}
          type="submit"
          onClick={button.onSubmit}
        >
          {button.label}
        </Button>
      </div>
    </Form>

    <style jsx>{`
      @import 'src/theme';

      .settingsForm > :global(form) {
        display: flex;
        flex-direction: column;

        .actionArea {
          display: flex;
          flex-direction: column;
        }

        :global(.semanticButton) {
          flex: 0 0 100%;

          margin-right: 0;
        }

        @include desktop-tablet-only {
          .actionArea {
            flex-direction: row;
            justify-content: space-between;
          }

          :global(.semanticButton) {
            flex: 0 0 auto;
            order: 1;
          }
        }

        @include desktop-tablet-only {
          border: 1px solid $color-primary;
          padding: 1rem;
          background-color: rgba(124, 184, 228, 0.12);
        }
      }
    `}</style>
  </div>
)

SettingsForm.propTypes = propTypes

export default SettingsForm
