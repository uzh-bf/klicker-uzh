import React, { useState } from 'react'
import { useRouter } from 'next/router'
import { Button, List, Input } from 'semantic-ui-react'
import { push } from '@socialgouv/matomo-next'
import KlickerLogoSrc from '../../public/KlickerUZH_Gray_Transparent.png'
import Image from 'next/image'

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

        <div className="flex flex-col w-full p-4 mb-4 border border-solid lg:items-center lg:justify-between lg:flex-row lg:flex-wrap border-primary bg-primary-10">
          <p className="mb-2 lg:flex-00full">Want to participate in a poll?</p>
          <Input
            fluid
            label="app.klicker.uzh.ch/join/"
            placeholder="account id"
            value={shortname}
            onChange={(e): void => setShortname(e.target.value)}
            className="flex-grow lg:mr-2"
          />
          <Button
            className="!mr-0 !mt-2 lg:!mt-0"
            primary
            disabled={!shortname || shortname === ''}
            onClick={redirectToJoin}
          >
            Participate
          </Button>
        </div>

        <div className="flex flex-col lg:flex-row">
          <a
            className="block p-4 mb-2 text-black border border-solid border-primary bg-primary-10 lg:p-4 lg:h-72 lg:w-72 lg:mr-2"
            href="https://www.klicker.uzh.ch/docs/introduction/getting_started"
            rel="noopener noreferrer"
            target="_blank"
          >
            <h2 className="text-2xl leading-6">Project</h2>
            <p>Learn more about Klicker.</p>
          </a>
          <a
            className="block p-4 mb-2 text-black border border-solid border-primary bg-primary-10 lg:p-4 lg:h-72 lg:w-72 lg:mr-2"
            href="https://www.klicker.uzh.ch/docs/introduction/getting_started"
            rel="noopener noreferrer"
            target="_blank"
          >
            <h2 className="block text-2xl leading-6">Lecturer</h2>
            <p>How to use Klicker as a lecturer!</p>
          </a>
          <div className="p-4 mb-0 text-black border border-solid last:mr-0 border-primary bg-primary-10 lg:p-4 lg:h-72 lg:w-72 lg:mr-2">
            <h2 className="text-2xl leading-6">Development</h2>
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
                  <List.Header as="a" href="https://www.klicker.uzh.ch/roadmap">
                    Public Roadmap
                  </List.Header>
                  <List.Description>Public Roadmap</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="github" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://github.com/uzh-bf/klicker-uzh">
                    uzh-bf/klicker-uzh
                  </List.Header>
                  <List.Description>Github Repository</List.Description>
                </List.Content>
              </List.Item>
            </List>
          </div>
        </div>

        <List className="userLinks">
          {links.map(
            (link): React.ReactElement => (
              <List.Item key={link.label} className="mb-4 !inline-block mr-2">
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
