import React from 'react'
import { Button, Container, Menu } from 'semantic-ui-react'
import { Link as ScrollLink } from 'react-scroll'
import Link from 'next/link'

import KlickerUZH from './KlickerUZH'

function Header() {
  return (
    <header className="bg-white">
      <Container>
        <div className="flex flex-col items-center justify-between lg:flex-row">
          <div className="mt-4 lg:my-1 lg:w-52">
            <Link href="/">
              <KlickerUZH />
            </Link>
          </div>

          <Menu text as="nav">
            <Menu.Item>
              <Link href="/">Home</Link>
            </Menu.Item>

            <Menu.Item>
              <Link href="/roadmap">Roadmap</Link>
            </Menu.Item>

            <Menu.Item>
              <Link href="https://uzh-bf.github.io/klicker-uzh/docs/faq/faq">
                <a target="_blank" rel="noopener noreferrer">
                  FAQ
                </a>
              </Link>
            </Menu.Item>

            <Menu.Item>
              <ScrollLink to="footer" smooth duration={500} offset={-50}>
                <a className="cursor-pointer">Contact Us</a>
              </ScrollLink>
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
