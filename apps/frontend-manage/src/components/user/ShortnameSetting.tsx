import { useLazyQuery, useMutation } from '@apollo/client'
import { faSave } from '@fortawesome/free-regular-svg-icons'
import {
  faCircleExclamation,
  faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ChangeShortnameDocument,
  CheckShortnameAvailableDocument,
  User,
} from '@klicker-uzh/graphql/dist/ops'
import DebouncedUsernameField from '@klicker-uzh/shared-components/src/DebouncedUsernameField'
import { Button, Tooltip } from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as Yup from 'yup'
import SimpleSetting from '../../components/user/SimpleSetting'

interface ShortnameSettingProps {
  user?: User | null
}

function ShortnameSetting({ user }: ShortnameSettingProps) {
  const t = useTranslations()

  const [isShortnameAvailable, setIsShortnameAvailable] = useState<
    boolean | undefined
  >(true)

  const [changeShortname] = useMutation(ChangeShortnameDocument)
  const [checkShortnameAvailable] = useLazyQuery(
    CheckShortnameAvailableDocument
  )

  const [editShortname, setEditShortname] = useState(false)

  return (
    <SimpleSetting
      label={t('shared.generic.shortname')}
      tooltip={t.rich('manage.settings.shortnameRequirements', {
        ul: (children) => <ul>{children}</ul>,
        li: (children) => <li>- {children}</li>,
      })}
    >
      {editShortname ? (
        <Formik
          initialValues={{ shortname: user?.shortname || '' }}
          onSubmit={async (values, { setErrors, setSubmitting }) => {
            setSubmitting(true)
            const trimmedShortname = values.shortname.trim()

            const result = await changeShortname({
              variables: { shortname: trimmedShortname },
            })

            if (!result) {
              setErrors({
                shortname: t('shared.generic.systemError'),
              })
            } else if (
              result.data?.changeShortname?.shortname !== trimmedShortname
            ) {
              setErrors({
                shortname: t('manage.settings.shortnameTaken'),
              })
            } else {
              setSubmitting(false)
              setEditShortname(false)
            }
          }}
          validationSchema={Yup.object().shape({
            shortname: Yup.string()
              .required(t('manage.settings.shortnameRequired'))
              .min(5, t('manage.settings.shortnameMin'))
              .max(8, t('manage.settings.shortnameMax'))
              .matches(
                /^[a-zA-Z0-9]*$/,
                t('manage.settings.shortnameAlphanumeric')
              ),
          })}
        >
          {({ isSubmitting, isValid, errors, validateField }) => (
            <Form className="flex flex-row items-center gap-1 font-normal text-black">
              {Object.keys(errors).length > 0 && (
                <Tooltip
                  tooltip={Object.values(errors)[0]}
                  delay={0}
                  className={{ tooltip: 'text-sm' }}
                >
                  <FontAwesomeIcon
                    icon={faCircleExclamation}
                    className="mr-1 text-red-600"
                  />
                </Tooltip>
              )}
              <DebouncedUsernameField
                className={{
                  root: 'w-36',
                  label: 'hidden',
                  input: 'bg-white h-8',
                  icon: 'bg-transparent',
                }}
                name="shortname"
                label={t('shared.generic.shortname')}
                labelType="normal"
                valid={isShortnameAvailable}
                setValid={(shortnameAvailable: boolean | undefined) =>
                  setIsShortnameAvailable(shortnameAvailable)
                }
                validateField={async () => {
                  await validateField('shortname')
                }}
                checkUsernameAvailable={async (name: string) => {
                  const { data: result } = await checkShortnameAvailable({
                    variables: { shortname: name },
                  })
                  return result?.checkShortnameAvailable ?? false
                }}
                data={{ cy: 'shortname-update-field' }}
                required
                hideError
              />
              <Button
                disabled={isSubmitting || !isValid}
                type="submit"
                className={{
                  root: 'h-8 w-8 items-center justify-center shadow-none border-uzh-grey-60',
                }}
                data={{ cy: 'save-shortname' }}
              >
                <FontAwesomeIcon icon={faSave} />
              </Button>
            </Form>
          )}
        </Formik>
      ) : (
        <div className="flex flex-row items-center gap-5 italic font-normal text-black">
          <div>{user?.shortname}</div>
          <FontAwesomeIcon
            icon={faPencil}
            className="hover:cursor-pointer hover:text-primary-80"
            onClick={() => setEditShortname(true)}
          />
        </div>
      )}
    </SimpleSetting>
  )
}

export default ShortnameSetting
