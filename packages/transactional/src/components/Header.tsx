import { Column, Img, Row, Section, Text } from '@react-email/components'

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
          <Column className="w-full border-0 border-l-[1px] border-solid border-gray-200 pl-6">
            <Text className="text-lg font-semibold">KlickerUZH</Text>
          </Column>
        </Row>
      </Section>
    </>
  )
}

export default Header
