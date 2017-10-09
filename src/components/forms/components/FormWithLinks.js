import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import { Button, List } from 'semantic-ui-react'

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
  <form className="ui form error">
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

    <style jsx>{`
        .form,
        .actionArea {
          display: flex;
          flex-direction: column;
        }

        .links {
          margin-top: 1rem;
        }

        .form :global(.semanticButton) {
          flex: 0 0 100%;

          margin-right: 0;
        }

        @media all and (min-width: 768px) {
          .actionArea {
            flex-direction: row;
            justify-content: space-between;
          }

          .links {
            order: 0;

            margin-top: 0;
          }

          .form :global(.semanticButton) {
            flex: 0 0 auto;
            order: 1;
          }
        }

        @media all and (min-width: 991px) {
          .form {
            border: 1px solid lightgrey;
            padding: 1rem;
          }
        }
      `}</style>
  </form>
)

FormWithLinks.propTypes = propTypes
FormWithLinks.defaultProps = defaultProps

export default FormWithLinks
