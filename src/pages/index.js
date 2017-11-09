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
          <p>Github, ...</p>
        </div>
      </div>

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

    <style jsx>{`
      @import 'src/theme';

      .klicker {
        padding: 0.2rem;

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
            padding: 5px;
            margin-bottom: 5px;

            border: 1px solid $color-primary;
            background-color: rgba(124, 184, 228, 0.12);

            &:last-child {
              margin-bottom: 0;
            }

            &:hover {
              background-color: rgba(124, 184, 228, 0.22);
              box-shadow: 0 6px 10px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.1);
            }
          }
        }

        :global(.list) {
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

        @include desktop-tablet-only {
          padding: 1rem;

          h1 {
            margin-top: 0;
          }

          .boxes {
            flex-direction: row;

            .box {
              cursor: pointer;
              height: 200px;
              width: 200px;
              margin-right: 5px;

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
