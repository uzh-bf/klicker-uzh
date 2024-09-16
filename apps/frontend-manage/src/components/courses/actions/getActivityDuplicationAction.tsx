import { WizardMode } from '@components/sessions/creation/ElementCreation'
import { faCopy } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { NextRouter } from 'next/router'

interface getActivityDuplicationActionProps {
  id: string
  text: string
  wizardMode: WizardMode
  router: NextRouter
  data: { text?: string; cy?: string }
}

function getActivityDuplicationAction({
  id,
  text,
  wizardMode,
  router,
  data,
}: getActivityDuplicationActionProps) {
  return {
    label: (
      <div className="text-primary-100 flex cursor-pointer flex-row items-center gap-2">
        <FontAwesomeIcon icon={faCopy} />
        <div>{text}</div>
      </div>
    ),
    onClick: () =>
      router.push({
        pathname: '/',
        query: {
          elementId: id,
          duplicationMode: wizardMode,
        },
      }),
    data,
  }
}

export default getActivityDuplicationAction
