import { MjmlColumn, MjmlSection, MjmlWrapper } from '@faire/mjml-react'
import BaseLayout from './components/BaseLayout'
import Button from './components/Button'
import Footer from './components/Footer'
import Header from './components/Header'
import Heading from './components/Heading'
import Text from './components/Text'
import { colors, fontFamily, fontSize, screens, spacing } from './theme'

const welcomeStyle = `
  .h1 > * {
    font-size: 56px !important;
  }
  .h2 > * {
    font-size: ${fontSize.lg}px !important;
  }
  .p > * {
    font-size: ${fontSize.base}px !important;
  }

  @media (min-width:${screens.xs}) {
    .h1 > * {
      font-size: 84px !important;
    }
    .h2 > * {
      font-size: ${fontSize.xxl}px !important;
    }
    .p > * {
      font-size: ${fontSize.md}px !important;
    }
  }
`

type MagicLinkEmailTemplateProps = {
  baseUrl: string
  magicLinkJWT: string
}

function MagicLinkEmailTemplate({
  baseUrl,
  magicLinkJWT,
}: MagicLinkEmailTemplateProps) {
  return (
    <BaseLayout width={600} style={welcomeStyle}>
      <Header />
      <MjmlWrapper backgroundColor={colors.black}>
        <MjmlSection paddingBottom={spacing.s11} cssClass="gutter">
          <MjmlColumn>
            <Heading maxWidth={420} cssClass="h1" fontFamily={fontFamily.serif}>
              Login with Magic Link
            </Heading>
          </MjmlColumn>
        </MjmlSection>
        <MjmlSection paddingBottom={spacing.s11} cssClass="gutter">
          <MjmlColumn>
            <Text
              cssClass="p"
              fontSize={fontSize.md}
              paddingBottom={spacing.s7}
            >
              Click on the following link to log-in:
            </Text>

            <Button
              href={`${baseUrl}/magicLogin?token=${magicLinkJWT}`}
              backgroundColor={colors.green300}
              align="left"
            >
              Log-in now
            </Button>
          </MjmlColumn>
        </MjmlSection>
      </MjmlWrapper>
      <Footer />
    </BaseLayout>
  )
}

MagicLinkEmailTemplate.subject = 'KlickerUZH - Magic Link'

export default MagicLinkEmailTemplate
