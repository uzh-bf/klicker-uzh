import { Column, Img, Markdown, Row, Section } from '@react-email/components'

function Footer() {
  return (
    <Section className="bg-uzh-grey-20 px-8 py-2">
      <Row>
        <Column className="w-full">
          <Markdown markdownCustomStyles={{}}>
            {`
**KlickerUZH**<br/>
Teaching Center<br/>
Department of Finance<br/>
Plattenstrasse 14<br/>
8032 Zürich

[www.klicker.uzh.ch](https://www.klicker.uzh.ch) - [community.klicker.uzh.ch](https://community.klicker.uzh.ch)

[Impressum](https://www.df.uzh.ch/de/impressum.html) - [Privacy Policy](https://www.klicker.uzh.ch/privacy_policy/)
            `}
          </Markdown>
        </Column>
        <Column className="w-42">
          <Img
            className="h-12"
            src="https://www.klicker.uzh.ch/img/KlickerLogo.png"
          />
        </Column>
      </Row>
    </Section>
  )
}

export default Footer
