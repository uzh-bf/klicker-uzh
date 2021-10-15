import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import getConfig from 'next/config'
import { Button, List, Input } from 'semantic-ui-react'

import StaticLayout from '../components/layouts/StaticLayout'
import useLogging from '../lib/hooks/useLogging'

const { publicRuntimeConfig } = getConfig()

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
      <div className="p-10">
        <h1 className="mb-3 text-3xl leading-8 text-center">
          Klicker
          <span className="text-base leading-4 align-top border-gray-300">UZH</span>
        </h1>

        <p className="p-1 mb-4 italic text-center border-gray-300">Welcome to the open source instant audience response system.</p>

        <div className="p-4 mb-4 bg-blue-50 border border-blue-400 border-solid">
          <p className="">Want to participate in a poll?</p>
          <div className="flex flex-col md:flex-row">
            <Input
              className="flex-grow mr-0 md:mr-3"
              fluid
              label={`${publicRuntimeConfig.baseUrl}/join/`}
              placeholder="account id"
              value={shortname}
              onChange={(e): void => setShortname(e.target.value)}
            />
            <Button className="w-full md:w-auto" primary disabled={!shortname || shortname === ''} onClick={redirectToJoin}>
              Participate
            </Button>
          </div>
        </div>

        <div className="flex justify-between flex-col lg:flex-row">
          <a
            className="flex-1 block p-4 mb-1 text-black bg-blue-50 border border-blue-400 border-solid lg:cursor-pointer lg:mr-2 lg:p-4 hover:bg-blue-100 hover:text-black hover:shadow-2xl"
            href="https://uzh-bf.github.io/klicker-uzh/docs/introduction/getting_started"
            rel="noopener noreferrer"
            target="_blank"
          >
            <h2 className="text-lg text-black">Documentation</h2>
            <p>Learn more about Klicker.</p>
          </a>
          <a
            className="flex-1 block p-4 mb-1 text-black bg-blue-50 border border-blue-400 border-solid lg:cursor-pointer lg:mr-2 lg:p-4 hover:bg-blue-100 hover:text-black hover:shadow-2xl"
            href="https://www.klicker.uzh.ch/roadmap"
            rel="noopener noreferrer"
            target="_blank"
          >
            <h2 className="text-lg text-black">Roadmap</h2>
            <p>Defined goals and milestones.</p>
          </a>
          <div className="flex-1 block p-4 mb-1 leading-6 text-black bg-blue-50 border border-blue-400 border-solid lg:mr-0 lg:p-4">
            <h2 className="text-lg text-black">Ressources</h2>
            <List divided relaxed>
              <List.Item>
                <List.Icon name="mail" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href={`mailto:${publicRuntimeConfig.supportEmail}`}>
                    {publicRuntimeConfig.supportEmail}
                  </List.Header>
                  <List.Description>Support</List.Description>
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
              <List.Item>
                <List.Icon name="edit" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://uzh-bf.github.io/klicker-uzh/docs/faq/changelog">
                    Changelog
                  </List.Header>
                  <List.Description>Major Releases</List.Description>
                </List.Content>
              </List.Item>
              <List.Item>
                <List.Icon name="question circle" size="large" verticalAlign="middle" />
                <List.Content>
                  <List.Header as="a" href="https://uzh-bf.github.io/klicker-uzh/docs/faq/faq">
                    FAQ
                  </List.Header>
                  <List.Description>Frequently Asked Questions</List.Description>
                </List.Content>
              </List.Item>
            </List>
          </div>
        </div>

        <List className="">
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
    </StaticLayout>
  )
}

export default Index
