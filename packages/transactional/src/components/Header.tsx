import { Section, Row, Column, Img, Text } from '@react-email/components'
import React from 'react'

function Header() {
  return (
    <>
      {/* <Section className="bg-gray-50 px-4 py-1 text-center text-sm text-slate-500"></Section> */}
      <Section className="p-8">
        <Row>
          <Column className="pr-4">
            <Img
              src="https://www.klicker.uzh.ch/img_v3/uzhlogo_email.png"
              className="w-40"
            />
          </Column>
          <Column className="pl-6 w-full border-gray-200 border-solid border-0 border-l-[1px]">
            <Text className="text-lg font-semibold">KlickerUZH</Text>
          </Column>
        </Row>
      </Section>
    </>
  )
}

export default Header
