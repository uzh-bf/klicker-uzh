import { Navigation } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'

function CommonDocs() {
  const router = useRouter()
  return (
    <div>
      <div className="m-5 md:m-0 md:w-full md:max-w-xxl md:py-8 md:mx-auto">
        <Navigation className={{ root: 'w-full' }}>
          <Navigation.ButtonItem
            label="Info Page"
            onClick={() => router.push('/docs')}
          ></Navigation.ButtonItem>
          <Navigation.TriggerItem
            label="Getting Started"
            dropdownWidth="w-[11rem]"
          >
            <Navigation.DropdownItem
              title="Klicker App"
              onClick={() => router.push('/docs/klickerApp')}
            />
            <Navigation.DropdownItem
              title="Erstmaliges Login"
              onClick={() => router.push('/docs/login')}
            />
          </Navigation.TriggerItem>
          <Navigation.TriggerItem label="Features" dropdownWidth="w-[11rem]">
            <Navigation.DropdownItem
              title="Umfragen"
              onClick={() => router.push('/docs/umfragen')}
              className={{ root: 'text-center' }}
            />
            <Navigation.DropdownItem
              title="Live Q&A"
              onClick={() => router.push('/docs/liveQA')}
            />
            <Navigation.DropdownItem
              title="Gruppenaktivitäten"
              onClick={() => router.push('/docs/groupActivities')}
            />
            <Navigation.DropdownItem
              title="Microlearning"
              onClick={() => router.push('/docs/microlearning')}
            />
            <Navigation.DropdownItem
              title="Selbsttests"
              onClick={() => router.push('/docs/selbsttests')}
            />
          </Navigation.TriggerItem>
        </Navigation>
      </div>
    </div>
  )
}
export default CommonDocs
