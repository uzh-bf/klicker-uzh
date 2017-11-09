import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { Button, Form, List } from 'semantic-ui-react'

const propTypes = {
  button: PropTypes.shape({
    invalid: PropTypes.bool.isRequired,
    label: PropTypes.string.isRequired,
    onSubmit: PropTypes.func.isRequired,
  }).isRequired,
  children: PropTypes.node.isRequired,
  links: PropTypes.arrayOf(
    PropTypes.shape({
      href: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ),
}

const defaultProps = {
  links: [],
}

const FormWithLinks = ({ button, children, links }) => (
  <div className="formWithLinks">
    <Form error>
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

        <div className="links">
          <List>
            {links.map(link => (
              <List.Item>
                <Link href={link.href}>
                  <a>{link.label}</a>
                </Link>
              </List.Item>
            ))}
          </List>
        </div>
      </div>
    </Form>

    <style jsx>{`
      @import 'src/theme';

      .formWithLinks > :global(form) {
        display: flex;
        flex-direction: column;

        .actionArea {
          display: flex;
          flex-direction: column;
        }

        .links {
          margin-top: 1rem;
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

          .links {
            order: 0;

            margin-top: 0;
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

FormWithLinks.propTypes = propTypes
FormWithLinks.defaultProps = defaultProps

export default FormWithLinks
