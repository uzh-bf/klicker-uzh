// @flow

import * as React from 'react'
import Link from 'next/link'
import { Helmet } from 'react-helmet'
import { Button, List } from 'semantic-ui-react'

import { createLinks } from '../../../lib'

type Props = {
  button: {
    invalid: boolean,
    label: string,
    handleSubmit: () => mixed,
  },
  children: any, // redux-form <Field> passed as children
  links: Array<{
    href: string,
    label: string,
  }>,
}

const FormWithLinks = ({ button, children, links }: Props) => (
  <form className="ui form error">
    <Helmet defer={false}>{createLinks(['button', 'form', 'list'])}</Helmet>

    {children}

    <div className="actionArea">
      <Button
        primary
        className="semanticButton"
        disabled={button.invalid}
        type="submit"
        onClick={button.handleSubmit}
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

export default FormWithLinks
