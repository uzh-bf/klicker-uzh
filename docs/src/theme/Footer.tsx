import { useColorMode } from '@docusaurus/theme-common'
import { twMerge } from 'tailwind-merge'

const Footer = () => {
  const { isDarkTheme } = useColorMode()

  return (
    <div
      className={twMerge('w-full bg-gray-100', isDarkTheme && 'bg-gray-700')}
    >
      <div className="mt-6 text-center ">
        <a href="/">
          <img
            src="/img/KlickerLogo.png"
            className={twMerge(
              'w-52 opacity-50 transition-opacity duration-1000 ease-out sm:hover:opacity-100'
            )}
          />
        </a>
      </div>
      <div className="lg:px-18 mb-6 flex w-full flex-col justify-center text-center md:px-10">
        <div className="max-w-6xl self-center px-10">
          Copyright {new Date().getFullYear()} @ Teaching Center, Department of
          Banking and Finance (https://www.bf.uzh.ch), University of Zurich. All
          rights reserved. Products and Services displayed herein are trademarks
          or registered trademarks of their respective owners.
        </div>
        <div className="max-w-6xl self-center px-10">
          <a href="/privacy_policy" className="whitespace-nowrap">
            Privacy Policy
          </a>
          {' | '}
          <a href="/terms_of_service" className="whitespace-nowrap">
            Terms of Service
          </a>
          {' | '}
          <a
            href="https://klicker-uzh.betteruptime.com/"
            className="whitespace-nowrap"
            target="_blank"
          >
            System Status
          </a>
          {' | '}
          <a
            href="https://community.klicker.uzh.ch"
            className="whitespace-nowrap"
          >
            User Community
          </a>
        </div>
      </div>
    </div>
  )
}

export default Footer
