import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Button, List, Input } from 'semantic-ui-react'

import StaticLayout from '../components/layouts/StaticLayout'
import useLogging from '../lib/hooks/useLogging'

const links = [
  {
    href: '/user/login',
    label: 'Login',
  },
  {
    href: '/user/registration',
    label: 'Sign Up',
  },
]

function Index(): React.ReactElement {
  useLogging({ logRocket: false })

  const router = useRouter()

  const [shortname, setShortname] = useState('')

  const redirectToJoin = (): Promise<boolean> => router.replace(`/join/${shortname}`)

  return (
    // TODO: internationalization
    <StaticLayout pageTitle="Klicker">
      <div className="klicker">
        <h1>
          Klicker
          <span>UZH</span>
        </h1>

        <p className="description">Welcome to the open source instant audience response system.</p>

        <div className="participation">
          <p>Want to participate in a poll?</p>
          <Input
            fluid
            label="app.klicker.uzh.ch/join/"
            placeholder="account id"
            value={shortname}
            onChange={(e): void => setShortname(e.target.value)}
          />
          <Button primary disabled={!shortname || shortname === ''} onClick={redirectToJoin}>
            Participate
          </Button>
        </div>

        <div className="boxes">
          <a
            className="box hoverable"
            href="https://uzh-bf.github.io/klicker-uzh/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <h2>Project</h2>
            <p>Learn more about Klicker.</p>
          </a>
          <a
            className="box hoverable"
            href="https://uzh-bf.github.io/klicker-uzh/"
            rel="noopener noreferrer"
            target="_blank"
          >
            <h2>Lecturer</h2>
            <p>How to use Klicker as a lecturer!</p>
          </a>
          <div className="box">
            <h2>Development</h2>
            <List divided relaxed>
              {/* <List.Item>
              <List.Icon name="slack" size="large" verticalAlign="middle" />
              <List.Content>
                <List.Header as="a">Slack-Channel</List.Header>
                <List.Description>Support & Discussions</List.Description>
              </List.Content>
            </List.Item>    */}

              <List.Item>
                <List.Icon name="mail" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="mailto:klicker.support@uzh.ch">
                    klicker.support@uzh.ch
                  </List.Header>
                  <List.Description>Support</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="github" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://github.com/uzh-bf/klicker-uzh/projects/4">
                    klicker-roadmap
                  </List.Header>
                  <List.Description>Public Github Roadmap</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="github" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://github.com/uzh-bf/klicker-uzh">
                    uzh-bf/klicker-uzh
                  </List.Header>
                  <List.Description>Public Github Repository</List.Description>
                </List.Content>
              </List.Item>
            </List>
          </div>
        </div>

        <List className="userLinks">
          {links.map(
            (link): React.ReactElement => (
              <List.Item>
                <Link href={link.href}>
                  <Button primary>{link.label}</Button>
                </Link>
              </List.Item>
            )
          )}
        </List>
      </div>

      <style jsx>{`
        @import 'src/theme';
        .klicker {
          padding: 0.5rem;
          h1 {
            text-align: center;
            font-size: 2rem;
            line-height: 2rem;
            margin-top: 1rem;
            span {
              vertical-align: top;
              font-size: 1rem;
              line-height: 1rem;
            }
          }
          h2 {
            font-size: 1.15rem;
          }
          .description {
            font-style: italic;
            text-align: center;
          }

          .participation {
            display: flex;
            flex-direction: column;

            border: 1px solid $color-primary;
            background-color: $color-primary-10p;
            padding: 1rem;
            width: 100%;
            margin-bottom: 1rem;

            p {
              margin-bottom: 0.5rem;
            }

            :global(.input) {
              flex: 1;
            }

            :global(button) {
              flex: 0 0 auto;
              margin-top: 0.5rem;
              margin-right: 0;
            }
          }

          .boxes {
            display: flex;
            flex-direction: column;
            .box {
              color: black;
              display: block;
              padding: 1rem;
              margin-bottom: 0.3rem;
              border: 1px solid $color-primary;
              background-color: $color-primary-10p;
              &:last-child {
                margin-bottom: 0;
              }
            }
            .hoverable:hover {
              background-color: $color-primary-20p;
              box-shadow: 0 6px 10px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.1);
            }
          }
          > :global(.list.userLinks) {
            margin-bottom: 1rem;
            :global(.item) {
              display: inline-block;
              margin-right: 0.5rem;
              :global(a:hover) {
                color: $color-primary;
              }
              &:last-child {
                margin-right: 0;
              }
            }
          }
          @media all and (min-width: 71.5rem) {
            h1 {
              margin-top: 0;
            }
            .participation {
              flex-flow: row wrap;
              align-items: center;
              justify-content: space-between;

              p {
                flex: 0 0 100%;
              }

              :global(input) {
                margin-right: 1rem;
              }

              :global(button) {
                margin-top: 0;
              }
            }
            .boxes {
              flex-direction: row;
              .box {
                padding: 1rem;
                height: 17rem;
                width: 17rem;
                margin-right: 0.5rem;
                &:last-child {
                  margin-right: 0;
                }
                &.hoverable {
                  cursor: pointer;
                }
              }
            }
          }
        }
      `}</style>
    </StaticLayout>
  )
}

export default Index
