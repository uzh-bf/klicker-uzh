import React from 'react'
import Link from 'next/link'
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
    <div className="flex flex-col p-4 border border-solid rounded-md formWithLinks border-primary">
      <Form error className="!bg-transparent">
        {typeof children === 'function' ? children() : children}

        <div className="flex flex-col md:flex-row md:justify-between">
          <Button
            primary
            className="!flex-00full !mr-0 md:!order-1 md:!flex-00auto"
            disabled={button.invalid || button.disabled}
            loading={button.loading}
            type="submit"
            onClick={button.onSubmit}
          >
            {button.label}
          </Button>

          <div className="mt-4 md:order-0 md:mt-0">
            <List>{linkItems}</List>
          </div>
        </div>
      </Form>
    </div>
  )
}

export default FormWithLinks
