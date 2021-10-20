import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import getConfig from 'next/config'
import { Button, List, Input } from 'semantic-ui-react'
import Image from 'next/image'

import StaticLayout from '../components/layouts/StaticLayout'
import useLogging from '../lib/hooks/useLogging'

import KlickerLogoImageSrc from '../../public/KlickerUZH_Gray_Transparent.png'

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
      <div className="flex flex-col items-center pt-4">
        <div>
          <Image alt="KlickerUZH Logo" src={KlickerLogoImageSrc} />
        </div>

        <p className="p-1 mb-4 italic text-center border-gray-300">
          Welcome to the open source instant audience response system.
        </p>

        <div className="self-stretch p-4 mb-4 border border-blue-400 border-solid bg-blue-50">
          <p className="">Want to participate in a poll?</p>
          <div className="flex flex-col md:flex-row">
            <Input
              fluid
              className="flex-grow mr-0 md:mr-3"
              label={`${publicRuntimeConfig.baseUrl}/join/`}
              placeholder="account id"
              value={shortname}
              onChange={(e): void => setShortname(e.target.value)}
            />
            <Button
              primary
              className="w-full md:w-auto"
              disabled={!shortname || shortname === ''}
              onClick={redirectToJoin}
            >
              Participate
            </Button>
          </div>
        </div>

        <div className="flex flex-col self-stretch justify-between lg:flex-row">
          <a
            className="flex-1 block p-4 mb-1 text-black border border-blue-400 border-solid bg-blue-50 lg:cursor-pointer lg:mr-2 lg:p-4 hover:bg-blue-100 hover:text-black hover:shadow-2xl"
            href="https://uzh-bf.github.io/klicker-uzh/docs/introduction/getting_started"
            rel="noopener noreferrer"
            target="_blank"
          >
            <h2 className="text-lg text-black">Documentation</h2>
            <p>Learn more about Klicker.</p>
          </a>
          <a
            className="flex-1 block p-4 mb-1 text-black border border-blue-400 border-solid bg-blue-50 lg:cursor-pointer lg:mr-2 lg:p-4 hover:bg-blue-100 hover:text-black hover:shadow-2xl"
            href="https://www.klicker.uzh.ch/roadmap"
            rel="noopener noreferrer"
            target="_blank"
          >
            <h2 className="text-lg text-black">Roadmap</h2>
            <p>Defined goals and milestones.</p>
          </a>
          <div className="flex-1 block p-4 mb-1 text-black border border-blue-400 border-solid bg-blue-50 lg:mr-0 lg:p-4">
            <h2 className="text-lg text-black">Resources</h2>
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

        <div className="self-start pt-4 pb-4">
          <List horizontal>
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
      </div>
    </StaticLayout>
  )
}

export default Index
