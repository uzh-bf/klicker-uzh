import { Header, Icon } from 'semantic-ui-react'
import Link from 'next/link'

interface Props {
  title: string
  subtitle?: string
  href: string
  icon?: string
}

const defaultProps = {
  subtitle: undefined,
  icon: undefined,
}

function SupportEntry({ title, subtitle, href, icon }: Props) {
  return (
    <Link passHref href={href}>
      <a rel="noopener noreferrer" target="_blank">
        <div className="p-4 border border-solid rounded-lg hover:bg-gray-200 hover:cursor-pointer">
          <Header size="small">
            {icon && <Icon name={icon} />}
            <Header.Content>
              {title}
              {subtitle && <Header.Subheader>{subtitle}</Header.Subheader>}
            </Header.Content>
          </Header>
        </div>
      </a>
    </Link>
  )
}

SupportEntry.defaultProps = defaultProps

export default SupportEntry
