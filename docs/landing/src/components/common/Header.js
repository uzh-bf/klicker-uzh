import React from 'react'
import { Button, Container, Menu } from 'semantic-ui-react'
import { Link as ScrollLink } from 'react-scroll'
import { Link } from 'gatsby'

export default function Header() {
  return (
    <header>
      <Container>
        <div className="klicker-headerContent">
          <div className="klicker-logo">
            <Link to="/">
              Klicker
              <span className="klicker-logo-high">UZH</span>
            </Link>
          </div>

          <Menu text as="nav">
            <Menu.Item as={Link} to="/" name="home">
              Home
            </Menu.Item>

            <Menu.Item
              name="faq"
              as="a"
              href="https://uzh-bf.github.io/klicker-uzh/docs/faq/faq"
              target="_blank"
              rel="noopener noreferrer"
            >
              FAQ
            </Menu.Item>

            <Menu.Item
              as={ScrollLink}
              to="footer"
              smooth
              duration={500}
              offset={-50}
              name="contact"
            >
              Contact
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

      <style jsx>{`
        header {
          background-color: white;
        }

        .klicker-headerContent {
          display: flex;
          flex-direction: column;

          align-items: center;
          justify-content: space-between;
        }

        .klicker-logo {
          margin-top: 1rem;

          color: #375164;
          font-size: 2rem;
          line-height: 2rem;
        }

        .klicker-logo-high {
          font-size: 1rem;
          line-height: 1rem;
          vertical-align: top;
        }

        :global(a.item) {
          color: blue;
        }

        @media all and (min-width: 986px) {
          .klicker-headerContent {
            flex-direction: row;
          }

          .klicker-logo {
            flex: 0 0 200px;
            margin: 0.25rem 0;
          }
        }
      `}</style>
    </header>
  )
}
