import { useMutation, useSuspenseQuery } from '@apollo/client'
import { faClipboard } from '@fortawesome/free-regular-svg-icons'
import { faArrowsRotate, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CreateUserLoginDocument,
  DeleteUserLoginDocument,
  GetUserLoginsDocument,
  UserLoginScope,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { monoSpaceFont } from '@klicker-uzh/shared-components/src/font'
import {
  Button,
  FormikSelectField,
  FormikTextField,
  H4,
  Label,
  Modal,
  Prose,
  Toast,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import generatePassword from 'generate-password'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import Setting from './Setting'

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
  const [confirmationModal, setConfirmationModal] = useState(false)
  const { data: userLogins } = useSuspenseQuery(GetUserLoginsDocument)
  // const { data: scope } = useSuspenseQuery(GetUserScopeDocument)

  const [createUserLogin] = useMutation(CreateUserLoginDocument, {
    refetchQueries: [GetUserLoginsDocument],
  })
  const [deleteUserLogin] = useMutation(DeleteUserLoginDocument, {
    refetchQueries: [GetUserLoginsDocument],
  })

  const [copiedPassword, setCopiedPassword] = useState(false)

  if (
    typeof userLogins?.userScope === 'undefined' ||
    userLogins.userScope !== UserLoginScope.AccountOwner
  ) {
    return null
  }

  const loginSchema = Yup.object().shape({
    password: Yup.string().required(),
    name: Yup.string().required(t('manage.settings.nameRequired')),
    scope: Yup.string().required(t('manage.settings.scopeRequired')),
  })

  // TODO: allow selection of other scopes once auth is ready on granular level
  const availableScopes: UserLoginScope[] = [UserLoginScope.FullAccess]

  return (
    <Setting title={t('auth.delegatedAccess')}>
      <div className="mb-5">
        <div className="flex flex-col gap-1">
          {userLogins.userLogins?.map((login) => (
            <div
              key={login.id}
              className={twMerge(
                'flex w-full flex-row justify-between rounded border border-solid bg-neutral-200 p-1'
              )}
            >
              <div className="ml-1 flex flex-row items-center gap-5">
                <div>{login.name}</div>
                <div
                  className={twMerge(
                    'w-max rounded px-1 py-0.5 text-sm font-bold',
                    login.scope === UserLoginScope.FullAccess && 'bg-green-300',
                    login.scope === UserLoginScope.SessionExec &&
                      'bg-yellow-200',
                    login.scope === UserLoginScope.ReadOnly && 'bg-orange-300'
                  )}
                >
                  {t(`manage.settings.${login.scope}`)}
                </div>
              </div>
              <div className="flex flex-row gap-0.5">
                <div className="mr-2 mt-auto text-sm text-neutral-500">
                  {login.lastLoginAt
                    ? t('manage.settings.lastUsed', {
                        date: dayjs(login.lastLoginAt).format('DD.MM.YYYY'),
                      })
                    : t('manage.settings.lastUsedNever')}
                </div>
                <Button
                  className={{ root: 'group' }}
                  onClick={() =>
                    deleteUserLogin({ variables: { id: login.id } })
                  }
                  data={{ cy: `delete-delegated-login-${login.name}` }}
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

        <div className={(userLogins.userLogins?.length || 0) > 0 ? 'mt-5' : ''}>
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
              setConfirmationModal(false)

              if (result.data?.createUserLogin) {
                resetForm()
                setFieldValue(
                  'password',
                  generatePassword.generate(PW_SETTINGS)
                )
              }
            }}
          >
            {({ values, setFieldValue, isValid, isSubmitting }) => {
              return (
                <Form>
                  <div className="flex flex-col gap-1.5 md:flex-row md:gap-0">
                    <div className="flex w-1/2 flex-row items-center gap-3">
                      <Label
                        label={t('shared.generic.shortname')}
                        tooltip={t('manage.settings.shortnameTooltip')}
                        className={{
                          root: 'font-bold',
                          tooltip: 'font-normal',
                        }}
                        showTooltipSymbol
                      />
                      <div>{shortname}</div>
                    </div>
                    <div className="flex w-full flex-row items-center justify-between md:w-1/2">
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
                        <div className={monoSpaceFont.className}>
                          {values.password}
                        </div>
                      </div>
                      <div className="flex flex-row gap-0.5">
                        <Button
                          onClick={() => {
                            navigator?.clipboard
                              ?.writeText(values.password)
                              .then(
                                () => {
                                  setCopiedPassword(true)
                                },
                                () => {
                                  setCopiedPassword(false)
                                }
                              )
                          }}
                          data={{ cy: 'copy-new-delegated-login-password' }}
                        >
                          <FontAwesomeIcon
                            icon={faClipboard}
                            className="-mx-1 w-4"
                          />
                        </Button>
                        <Button
                          onClick={() =>
                            setFieldValue(
                              'password',
                              generatePassword.generate(PW_SETTINGS)
                            )
                          }
                          data={{ cy: 'generate-new-delegated-login-password' }}
                        >
                          <FontAwesomeIcon
                            icon={faArrowsRotate}
                            className="-mx-1 w-4"
                          />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-col gap-2 md:flex-row md:gap-0">
                    <FormikTextField
                      name="name"
                      label={t('manage.settings.loginName')}
                      labelType="large"
                      className={{
                        root: 'md:w-1/2 md:pr-5',
                        input: 'bg-white',
                      }}
                      data={{ cy: 'delegated-login-name' }}
                      required
                    />
                    <FormikSelectField
                      name="scope"
                      placeholder={t('manage.settings.selectScope')}
                      // items={Object.values(UserLoginScope).map((scope) => ({
                      //   value: scope,
                      //   label: t(`manage.settings.${scope}`),
                      // }))}
                      items={availableScopes.map((scope) => ({
                        value: scope,
                        label: t(`manage.settings.${scope}`),
                        data: { cy: `delegated-login-scope-${scope}` },
                      }))}
                      label={t('manage.settings.scope')}
                      labelType="large"
                      className={{ root: 'md:w-1/2' }}
                      data={{ cy: 'delegated-login-scope' }}
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    className={{
                      root: twMerge(
                        'bg-primary-80 float-right mb-2 mt-2 text-white',
                        (!isValid || isSubmitting) &&
                          'bg-primary-20 cursor-not-allowed'
                      ),
                    }}
                    disabled={!isValid || isSubmitting}
                    data={{ cy: 'create-delegated-login' }}
                    onClick={() => setConfirmationModal(true)}
                  >
                    {t('manage.settings.createLogin')}
                  </Button>
                  <Modal
                    title={t('manage.settings.confirmDelegatedAcces')}
                    open={confirmationModal}
                    onClose={() => setConfirmationModal(false)}
                    className={{
                      content: 'h-max !min-h-[10rem] w-1/2 !pb-1',
                    }}
                  >
                    <div>
                      {t('manage.settings.confirmDelegatedAccesTooltip')}
                    </div>
                    <div className="mt-2 rounded-lg bg-gray-300 p-3">
                      <div>
                        <span className="font-bold">
                          {t('shared.generic.shortname')}:{' '}
                        </span>
                        {shortname}
                      </div>
                      <div className="flex flex-row items-center gap-2">
                        <div>
                          <span className="font-bold">
                            {t('shared.generic.password')}:{' '}
                          </span>
                          {values.password}
                        </div>
                        <Button
                          onClick={() => {
                            navigator?.clipboard
                              ?.writeText(values.password)
                              .then(
                                () => {
                                  setCopiedPassword(true)
                                },
                                () => {
                                  setCopiedPassword(false)
                                }
                              )
                          }}
                          data={{ cy: 'copy-new-delegated-login-password' }}
                        >
                          <FontAwesomeIcon
                            icon={faClipboard}
                            className="-mx-1 w-4"
                          />
                        </Button>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className={{
                        root: twMerge(
                          'bg-primary-80 float-right mb-2 mt-2 text-white',
                          (!isValid || isSubmitting) &&
                            'bg-primary-20 cursor-not-allowed'
                        ),
                      }}
                      disabled={!isValid || isSubmitting}
                      data={{ cy: 'confirm-delegated-login-creation' }}
                    >
                      {isSubmitting ? <Loader /> : t('shared.generic.confirm')}
                    </Button>
                  </Modal>
                </Form>
              )
            }}
          </Formik>
        </div>
        <Toast
          dismissible
          openExternal={copiedPassword}
          setOpenExternal={setCopiedPassword}
          type="success"
          duration={4000}
        >
          {t('manage.settings.copiedPassword')}
        </Toast>
      </div>
    </Setting>
  )
}

export default DelegatedAccessSettings
