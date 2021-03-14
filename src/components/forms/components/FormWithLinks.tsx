import Link from 'next/link'
import React from 'react'
import { Button, Form, List } from 'semantic-ui-react'

interface Props {
  button: {
    disabled?: boolean
    loading?: boolean
    invalid?: boolean
    label: string
    onSubmit: any
  }
  children: React.ReactNode | any
  links: {
    href: string
    label: string
  }[]
}

function FormWithLinks({ button, children, links }: Props): React.ReactElement {
  const linkItems = links.map(
    (link): React.ReactElement => (
      <List.Item>
        <Link href={link.href}>
          <a>{link.label}</a>
        </Link>
      </List.Item>
    )
  )

  return (
    <div className="formWithLinks">
      <Form error>
        {typeof children === 'function' ? children() : children}

        <div className="actionArea">
          <Button
            primary
            className="semanticButton"
            disabled={button.invalid || button.disabled}
            loading={button.loading}
            type="submit"
            onClick={button.onSubmit}
          >
            {button.label}
          </Button>

          <div className="links">
            <List>{linkItems}</List>
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
}

export default FormWithLinks
