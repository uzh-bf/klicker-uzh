import React from 'react'
import Link from 'next/link'

import { List } from 'semantic-ui-react'

import { StaticLayout } from '../components/layouts'

const links = [
  {
    href: '/user/login',
    label: 'Login',
  },
  {
    href: '/user/registration',
    label: 'Register',
  },
]

const Index = () => (
  // TODO: internationalization
  <StaticLayout pageTitle="Klicker">
    <div className="klicker">
      <h1>
        Klicker
        <span>UZH</span>
      </h1>
      <p className="description">Welcome to the open source instant audience response system.</p>

      <div className="boxes">
        <div className="box">
          <h2>Project</h2>
          <p>Learn more about Klicker.</p>
        </div>
        <div className="box">
          <h2>Lecturer</h2>
          <p>How to use Klicker as a lecturer!</p>
        </div>
        <div className="box">
          <h2>Audience</h2>
          <p>How to use Klicker as a participant.</p>
        </div>
        <div className="box">
          <h2>Development</h2>
          <List relaxed divided>
            <List.Item>
              <List.Icon name="github" size="large" verticalAlign="middle" />
              <List.Content>
                <List.Header as="a" href="https://github.com/uzh-bf/klicker-react">
                  uzh-bf/klicker-react
                </List.Header>
                <List.Description>Frontend</List.Description>
              </List.Content>
            </List.Item>
            <List.Item>
              <List.Icon name="github" size="large" verticalAlign="middle" />
              <List.Content>
                <List.Header as="a" href="https://github.com/uzh-bf/klicker-api">
                  uzh-bf/klicker-api
                </List.Header>
                <List.Description>Backend (API)</List.Description>
              </List.Content>
            </List.Item>
            <List.Item>
              <List.Icon name="slack" size="large" verticalAlign="middle" />
              <List.Content>
                <List.Header as="a">Slack-Channel</List.Header>
                <List.Description>Support & Discussions</List.Description>
              </List.Content>
            </List.Item>
            <List.Item>
              <List.Icon name="mail" size="large" verticalAlign="middle" />
              <List.Content>
                <List.Header as="a" href="mailto:support@klicker.uzh.ch">
                  support@klicker.uzh.ch
                </List.Header>
                <List.Description>Support</List.Description>
              </List.Content>
            </List.Item>
          </List>
        </div>
      </div>

      <List className="userLinks">
        {links.map(link => (
          <List.Item>
            <Link href={link.href}>
              <a>{link.label}</a>
            </Link>
          </List.Item>
        ))}
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

        .boxes {
          display: flex;
          flex-direction: column;

          .box {
            padding: 1rem;
            margin-bottom: 0.3rem;

            border: 1px solid $color-primary;
            background-color: $color-primary-10p;

            &:last-child {
              margin-bottom: 0;
            }

            &:hover {
              background-color: $color-primary-20p;
              box-shadow: 0 6px 10px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.1);
            }
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

          .boxes {
            flex-direction: row;

            .box {
              padding: 1rem;
              cursor: pointer;
              height: 17rem;
              width: 17rem;
              margin-right: 0.5rem;

              &:last-child {
                margin-right: 0;
              }
            }
          }
        }
      }
    `}</style>
  </StaticLayout>
)

export default Index
