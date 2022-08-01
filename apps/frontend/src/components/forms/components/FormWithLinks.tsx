import React from 'react'
import Link from 'next/link'
import { Form, List } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'

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
      <List.Item key={link.href}>
        <Link href={link.href}>
          <a>{link.label}</a>
        </Link>
      </List.Item>
    )
  )

  return (
    <div className="flex flex-col md:p-4 md:border-solid md:rounded-md md:border formWithLinks border-primary">
      <Form error className="!bg-transparent">
        {typeof children === 'function' ? children() : children}

        <div className="flex flex-col md:flex-row md:justify-between">
          <Button
            className="h-10 px-4 bg-uzh-blue-80 text-white flex-[0_0_100%] md:flex-[0_0_auto] order-1 justify-center disabled:opacity-60"
            disabled={button.invalid || button.disabled}
            loading={button.loading}
            type="submit"
            onClick={button.onSubmit}
          >
            <Button.Label>{button.label}</Button.Label>
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
