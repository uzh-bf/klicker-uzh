import { Header, Icon } from 'semantic-ui-react'

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
    <div className="p-4 border border-solid rounded-lg hover:bg-gray-200 hover:cursor-pointer">
      <a href={href} rel="noopener noreferrer" target="_blank">
        <Header size="small">
          {icon && <Icon name={icon} />}
          <Header.Content>
            {title}
            {subtitle && <Header.Subheader>{subtitle}</Header.Subheader>}
          </Header.Content>
        </Header>
      </a>
    </div>
  )
}

SupportEntry.defaultProps = defaultProps

export default SupportEntry
