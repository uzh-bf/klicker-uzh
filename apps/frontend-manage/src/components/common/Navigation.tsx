// TODO: extract this component to the design-system with correspondingly generalized props

import { IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
  Menubar as ShadcnMenubar,
} from '@uzh-bf/design-system/dist/future'
import { twMerge } from 'tailwind-merge'

// ! Syles
const dynamicUnderline = twMerge(
  'relative  after:absolute after:bottom-[0.3rem] after:left-[7.5px] after:h-[2px] after:w-[calc(100%-15px)] ',
  'after:origin-left after:scale-x-0 after:bg-slate-700 after:transition-transform after:duration-500',
  'after:ease-out hover:after:scale-x-100'
)

// ! Button
// #region
interface BaseNavigationButtonProps {
  onClick: () => void
  disabled?: boolean
  data?: { cy?: string; test?: string }
  className?: { root?: string; label?: string; icon?: string }
}

interface LabelOnlyButtonProps extends BaseNavigationButtonProps {
  label: string
  icon?: IconDefinition
  active: boolean
}

interface IconOnlyButtonProps extends BaseNavigationButtonProps {
  icon: IconDefinition
  label?: undefined
  active?: undefined
}

// combined type
type NavigationButtonProps = LabelOnlyButtonProps | IconOnlyButtonProps

function NavigationButton({
  label,
  icon,
  onClick,
  disabled = false,
  active,
  data,
  className,
}: NavigationButtonProps) {
  const hasIconAndLabel =
    typeof label !== 'undefined' && typeof icon !== 'undefined'
  const iconOnly = typeof label === 'undefined' && typeof icon !== 'undefined'

  return (
    <MenubarMenu>
      <MenubarTrigger
        onClick={onClick}
        disabled={disabled}
        data-cy={data?.cy}
        data-test={data?.test}
        className={twMerge(
          'text-base hover:cursor-pointer',
          !iconOnly && !disabled && dynamicUnderline,
          hasIconAndLabel && 'flex flex-row items-center gap-2',
          active && 'text-black after:scale-x-100',
          disabled && 'hover:cursor-not-allowed',
          className?.root
        )}
      >
        {hasIconAndLabel ? (
          <>
            <FontAwesomeIcon icon={icon} className={className?.icon} />
            <div className={className?.label}>{label}</div>
          </>
        ) : label ? (
          <div className={className?.label}>{label}</div>
        ) : (
          <FontAwesomeIcon icon={icon!} size="lg" className={className?.icon} />
        )}
      </MenubarTrigger>
    </MenubarMenu>
  )
}
// #endregion

// ! Dropdown
// #region
type NavigationMenuItemProps = {
  key: string
  type: 'link'
  label: string
  onClick: () => void
  data?: { cy?: string; test?: string }
  className?: { label?: string }
}

type NavigationSeparatorProps = {
  key: string
  type: 'separator'
}

type NavigationSubmenuProps = {
  key: string
  type: 'submenu'
  label: string
  options: NavigationMenuItemProps[]
  data?: { cy?: string; test?: string }
  className?: { label?: string }
}

interface BaseNavigationDropdownProps {
  elements: (
    | NavigationMenuItemProps
    | NavigationSeparatorProps
    | NavigationSubmenuProps
  )[]
  disabled?: boolean
  active?: boolean
  data?: { cy?: string; test?: string }
  className?: {
    trigger?: string
    label?: string
    icon?: string
    content?: string
  }
}

interface LabelOnlyDropdownProps extends BaseNavigationDropdownProps {
  label: string
  icon?: IconDefinition
}

interface IconOnlyDropdownProps extends BaseNavigationDropdownProps {
  label?: undefined
  icon: IconDefinition
}

// combined type
type NavigationDropdownProps = LabelOnlyDropdownProps | IconOnlyDropdownProps

function NavigationMenuItem({
  element,
}: {
  element: Omit<NavigationMenuItemProps, 'key'>
}) {
  return (
    <MenubarItem
      onClick={element.onClick}
      className={twMerge(
        'h-7 text-base hover:cursor-pointer',
        element.className?.label
      )}
      data-cy={element.data?.cy}
      data-test={element.data?.test}
    >
      {element.label}
    </MenubarItem>
  )
}

function NavigationDropdown({
  label,
  icon,
  disabled = false,
  active = false,
  elements,
  data,
  className,
}: NavigationDropdownProps) {
  const hasIconAndLabel =
    typeof label !== 'undefined' && typeof icon !== 'undefined'
  const iconOnly = typeof label === 'undefined' && typeof icon !== 'undefined'

  return (
    <MenubarMenu>
      <MenubarTrigger
        disabled={disabled}
        data-cy={data?.cy}
        data-test={data?.test}
        className={twMerge(
          'text-base hover:cursor-pointer',
          hasIconAndLabel && 'flex flex-row items-center gap-2',
          !iconOnly && !disabled && dynamicUnderline,
          active && 'text-black after:scale-x-100',
          disabled && 'hover:cursor-not-allowed',
          className?.trigger
        )}
      >
        {hasIconAndLabel ? (
          <>
            <FontAwesomeIcon icon={icon} className={className?.icon} />
            <div className={className?.label}>{label}</div>
          </>
        ) : label ? (
          <div className={className?.label}>{label}</div>
        ) : (
          <FontAwesomeIcon icon={icon!} size="lg" className={className?.icon} />
        )}
      </MenubarTrigger>
      {!disabled ? (
        <MenubarContent className={className?.content}>
          {elements.map((element) => {
            if (element.type === 'link') {
              return <NavigationMenuItem key={element.key} element={element} />
            } else if (element.type === 'separator') {
              return <MenubarSeparator key={element.key} />
            } else if (element.type === 'submenu') {
              return (
                <MenubarSub key={element.key}>
                  <MenubarSubTrigger
                    className={twMerge(
                      'h-8 text-base hover:cursor-pointer',
                      className?.label
                    )}
                  >
                    {element.label}
                  </MenubarSubTrigger>
                  <MenubarSubContent>
                    {element.options.map((option) => {
                      return (
                        <NavigationMenuItem key={option.key} element={option} />
                      )
                    })}
                  </MenubarSubContent>
                </MenubarSub>
              )
            }
          })}
        </MenubarContent>
      ) : null}
    </MenubarMenu>
  )
}
// #endregion

// ! Navigation
// #region
type NavigationButtonItemProps = NavigationButtonProps & {
  type: 'button'
  key: string
}

type NavigationDropdownItemProps = NavigationDropdownProps & {
  type: 'dropdown'
  key: string
}

export type NavigationItemProps =
  | NavigationButtonItemProps
  | NavigationDropdownItemProps

function Navigation({
  items,
  className,
}: {
  items: NavigationItemProps[]
  className?: {
    root?: string
  }
}) {
  return (
    <ShadcnMenubar
      className={twMerge('border-none bg-transparent', className?.root)}
    >
      {items.map((item) => {
        if (item.type === 'button') {
          return <NavigationButton {...item} key={item.key} />
        } else if (item.type === 'dropdown') {
          return <NavigationDropdown {...item} key={item.key} />
        }
      })}
    </ShadcnMenubar>
  )
}
// #endregion

export default Navigation
