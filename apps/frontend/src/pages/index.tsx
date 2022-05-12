import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { Button, List, Input } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'
import Image from 'next/image'
import KlickerLogoSrc from '../../public/KlickerUZH_Gray_Transparent.png'

import StaticLayout from '../components/layouts/StaticLayout'

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
  const router = useRouter()

  const [shortname, setShortname] = useState('')

  const redirectToJoin = (): Promise<boolean> => {
    push(['trackEvent', 'Landing', 'Participation Clicked'])
    return router.replace(`/join/${shortname}`)
  }

  return (
    // TODO: internationalization
    <StaticLayout pageTitle="Klicker">
      <div className="p-2">
        <div className="text-center">
          <Image alt="KlickerUZH Logo" src={KlickerLogoSrc} />
        </div>

        <p className="italic text-center">Welcome to the open source instant audience response system.</p>

        <div className="flex flex-col w-full p-4 mb-4 lg:items-center lg:justify-between lg:flex-row lg:flex-wrap border-primary ">
          <p className="mb-2 lg:flex-[0_0_100%]">Want to participate in a poll?</p>
          <Input
            fluid
            className="flex-grow lg:mr-2"
            label="app.klicker.uzh.ch/join/"
            placeholder="account id"
            value={shortname}
            onChange={(e): void => setShortname(e.target.value)}
          />
          <Button
            primary
            className="!mr-0 !mt-2 lg:!mt-0"
            disabled={!shortname || shortname === ''}
            onClick={redirectToJoin}
          >
            Participate
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row">
          <div className="block p-4 mb-2 text-black border border-solid rounded-md border-primary lg:p-4 lg:h-72 lg:w-72 lg:mr-2">
            <h2 className="text-2xl leading-6">User Guide</h2>
            <List divided relaxed>
              <List.Item>
                <List.Icon name="book" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://www.klicker.uzh.ch/introduction/getting_started" target="_blank">
                    Documentation
                  </List.Header>
                  <List.Description>Get started with KlickerUZH</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="question circle" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://www.klicker.uzh.ch/faq" target="_blank">
                    FAQ
                  </List.Header>
                  <List.Description>Common Questions</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="users" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://www.klicker.uzh.ch/use_cases/live_qa" target="_blank">
                    Use Cases
                  </List.Header>
                  <List.Description>KlickerUZH in Action</List.Description>
                </List.Content>
              </List.Item>
            </List>
          </div>
          <div className="block p-4 mb-2 text-black border border-solid rounded-md border-primary lg:p-4 lg:h-72 lg:w-72 lg:mr-2">
            <h2 className="block text-2xl leading-6">Development</h2>
            <List divided relaxed>
              <List.Item>
                <List.Icon name="github" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://github.com/uzh-bf/klicker-uzh" target="_blank">
                    uzh-bf/klicker-uzh
                  </List.Header>
                  <List.Description>GitHub Repository</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="sitemap" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://www.klicker.uzh.ch/development" target="_blank">
                    Public Roadmap
                  </List.Header>
                  <List.Description>Project Outline</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="bullhorn" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://www.klicker.uzh.ch/blog" target="_blank">
                    Project Updates
                  </List.Header>
                  <List.Description>Updates on developments</List.Description>
                </List.Content>
              </List.Item>
            </List>
          </div>
          <div className="p-4 mb-0 text-black border border-solid rounded-md last:mr-0 border-primary lg:p-4 lg:h-72 lg:w-72 lg:mr-2">
            <h2 className="text-2xl leading-6">Support</h2>
            <List divided relaxed>
              <List.Item>
                <List.Icon name="talk" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://www.klicker.uzh.ch/community" target="_blank">
                    Discussions
                  </List.Header>
                  <List.Description>User Community</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="lightbulb" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://klicker-uzh.feedbear.com/boards/feature-requests" target="_blank">
                    Feature Requests
                  </List.Header>
                  <List.Description>Request a new feature</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="github" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://github.com/uzh-bf/klicker-uzh/discussions" target="_blank">
                    Developer Support
                  </List.Header>
                  <List.Description>GitHub Discussions</List.Description>
                </List.Content>
              </List.Item>
            </List>
          </div>
        </div>

        <List>
          {links.map(
            (link): React.ReactElement => (
              <List.Item className="mb-4 !inline-block mr-2" key={link.label}>
                <a href={link.href} target="_self">
                  <Button primary>{link.label}</Button>
                </a>
              </List.Item>
            )
          )}
        </List>
      </div>
    </StaticLayout>
  )
}

export async function getStaticProps() {
  return {
    props: {},
  }
}

export default Index
