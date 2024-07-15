import {
  MjmlColumn,
  MjmlGroup,
  MjmlSection,
  MjmlWrapper,
} from '@faire/mjml-react'
import { colors, fontSize, fontWeight, lineHeight } from '../theme'
import Link from './Link'
import Text from './Text'

export default function Header() {
  return (
    <MjmlWrapper padding="40px 0 64px" backgroundColor={colors.black}>
      <MjmlSection cssClass="gutter">
        <MjmlGroup>
          <MjmlColumn width="42%">
            <Text align="left">
              <Link
                color={colors.white}
                fontSize={fontSize.xl}
                fontWeight={fontWeight.bold}
                href="https://www.klicker.uzh.ch"
                textDecoration="none"
              >
                <img
                  height={24}
                  width={112}
                  src={'https://www.df.uzh.ch/docroot/logos/uzh_logo_d_pos.svg'}
                  alt=""
                  style={{
                    verticalAlign: 'text-bottom',
                    paddingRight: 10,
                    paddingBottom: 2,
                  }}
                />
              </Link>
            </Text>
          </MjmlColumn>
          <MjmlColumn width="58%">
            <Text
              align="right"
              fontSize={fontSize.lg}
              lineHeight={lineHeight.tight}
              fontWeight={fontWeight.bold}
            >
              KlickerUZH
            </Text>
          </MjmlColumn>
        </MjmlGroup>
      </MjmlSection>
    </MjmlWrapper>
  )
}
