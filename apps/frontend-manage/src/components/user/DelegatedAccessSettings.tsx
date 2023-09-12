import { useMutation, useSuspenseQuery } from '@apollo/client'
import { faArrowsRotate, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateUserLoginDocument,
  DeleteUserLoginDocument,
  GetUserLoginsDocument,
  UserLoginScope,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSelectField,
  FormikTextField,
  H4,
  Label,
  Prose,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import generatePassword from 'generate-password'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

const PW_SETTINGS = {
  length: 16,
  uppercase: true,
  symbols: false,
  numbers: true,
}

interface DelegatedAccessSettingsProps {
  shortname?: string
}

function DelegatedAccessSettings({ shortname }: DelegatedAccessSettingsProps) {
  const t = useTranslations()
  const { data: userLogins } = useSuspenseQuery(GetUserLoginsDocument)
  const [createUserLogin] = useMutation(CreateUserLoginDocument, {
    refetchQueries: [GetUserLoginsDocument],
  })
  const [deleteUserLogin] = useMutation(DeleteUserLoginDocument, {
    refetchQueries: [GetUserLoginsDocument],
  })

  const loginSchema = Yup.object().shape({
    password: Yup.string().required(),
    name: Yup.string().required(t('manage.settings.nameRequired')),
    scope: Yup.string().required(t('manage.settings.scopeRequired')),
  })

  return (
    <div className="mb-5">
      <div className="flex flex-col gap-1">
        {userLogins.userLogins?.map((login) => (
          <div
            key={login.id}
            className={twMerge(
              'w-full border border-solid rounded flex flex-row justify-between bg-neutral-200 p-1'
            )}
          >
            <div className="flex flex-row items-center gap-5 ml-1">
              <div>{login.name}</div>
              <div
                className={twMerge(
                  'w-max rounded py-0.5 px-1 text-sm font-bold',
                  login.scope === UserLoginScope.FullAccess && 'bg-green-300',
                  login.scope === UserLoginScope.SessionExec && 'bg-yellow-200',
                  login.scope === UserLoginScope.ReadOnly && 'bg-orange-300'
                )}
              >
                {t(`manage.settings.${login.scope}`)}
              </div>
            </div>
            <div className="flex flex-row gap-0.5">
              <div className="text-neutral-500 text-sm mr-2 mt-auto">
                {login.lastLoginAt
                  ? t('manage.settings.lastUsed', {
                      date: dayjs(login.lastLoginAt).format('DD.MM.YYYY'),
                    })
                  : t('manage.settings.lastUsedNever')}
              </div>
              <Button
                className={{ root: 'group' }}
                onClick={() => deleteUserLogin({ variables: { id: login.id } })}
              >
                <FontAwesomeIcon
                  icon={faTrash}
                  className="group-hover:text-red-600"
                />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <H4>{t('manage.settings.createDelegatedLogin')}</H4>
        <Prose className={{ root: 'max-w-none' }}>
          {t('manage.settings.delegatedLoginDescription')}
        </Prose>
        <Formik
          isInitialValid={false}
          initialValues={{
            password: generatePassword.generate(PW_SETTINGS),
            name: '',
            scope: UserLoginScope.FullAccess,
          }}
          validationSchema={loginSchema}
          onSubmit={async (values, { resetForm, setFieldValue }) => {
            const result = await createUserLogin({
              variables: {
                name: values.name,
                password: values.password,
                scope: values.scope,
              },
            })

            if (result.data?.createUserLogin) {
              setFieldValue('password', generatePassword.generate(PW_SETTINGS))
              resetForm()
            }
          }}
        >
          {({ values, setFieldValue, isValid, isSubmitting }) => {
            return (
              <Form>
                <div className="flex flex-col md:flex-row">
                  <div className="flex flex-row items-center gap-3 w-1/2">
                    <Label
                      label={t('shared.generic.shortname')}
                      tooltip={t('manage.settings.shortnameTooltip')}
                      className={{ root: 'font-bold', tooltip: 'font-normal' }}
                      showTooltipSymbol
                    />
                    <div>{shortname}</div>
                  </div>
                  <div className="flex flex-row items-center justify-between w-1/2">
                    <div className="flex flex-row items-center gap-3">
                      <Label
                        label={t('shared.generic.password')}
                        tooltip={t('manage.settings.passwordTooltip')}
                        className={{
                          root: 'font-bold',
                          tooltip: 'font-normal',
                        }}
                        showTooltipSymbol
                      />
                      <div>{values.password}</div>
                    </div>
                    <Button
                      onClick={() =>
                        setFieldValue(
                          'password',
                          generatePassword.generate(PW_SETTINGS)
                        )
                      }
                    >
                      <FontAwesomeIcon icon={faArrowsRotate} />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row mt-1.5">
                  <FormikTextField
                    name="name"
                    label={t('manage.settings.loginName')}
                    className={{
                      root: 'w-1/2 pr-5',
                      input: ' bg-white',
                    }}
                    required
                  />
                  <FormikSelectField
                    name="scope"
                    placeholder={t('manage.settings.selectScope')}
                    // items={Object.values(UserLoginScope).map((scope) => ({
                    //   value: scope,
                    //   label: t(`manage.settings.${scope}`),
                    // }))}
                    // TODO: allow selection of other scopes once auth is ready on granular level
                    items={['FULL_ACCESS'].map((scope) => ({
                      value: scope,
                      label: t(`manage.settings.${scope}`),
                    }))}
                    label={t('manage.settings.scope')}
                    className={{ root: 'w-1/2' }}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className={{
                    root: twMerge(
                      'float-right mt-2 mb-2 bg-primary-80 text-white',
                      (!isValid || isSubmitting) &&
                        'bg-primary-20 cursor-not-allowed'
                    ),
                  }}
                  disabled={!isValid || isSubmitting}
                >
                  {t('manage.settings.createLogin')}
                </Button>
              </Form>
            )
          }}
        </Formik>
      </div>
    </div>
  )
}

export default DelegatedAccessSettings
