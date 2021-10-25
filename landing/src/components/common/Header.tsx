import React from 'react'
import { Button, Container, Menu } from 'semantic-ui-react'
import Link from 'next/link'

import KlickerLogo from './KlickerLogo'

function Header() {
  return (
    <header className="bg-white">
      <Container>
        <div className="flex flex-col items-center justify-between lg:flex-row">
          <div className="mt-4 lg:my-1 lg:w-52">
            <Link href="/">
              <KlickerLogo width={150} />
            </Link>
          </div>

          <Menu text as="nav" stackable>
            <Menu.Item>
              <Link href="/">Home</Link>
            </Menu.Item>

            <Menu.Item>
              <Link href="/roadmap">Roadmap &amp; Get Involved</Link>
            </Menu.Item>

            <Menu.Item>
              <Link href="https://www.klicker.uzh.ch/docs/faq/faq">
                <a target="_blank" rel="noopener noreferrer">
                  FAQ
                </a>
              </Link>
            </Menu.Item>

            <Menu.Item>
              <Button
                primary
                as="a"
                href="https://app.klicker.uzh.ch/user/login"
                target="_blank"
                rel="noopener noreferrer"
              >
                Login
              </Button>
            </Menu.Item>
          </Menu>
        </div>
      </Container>
    </header>
  )
}

export default Header
