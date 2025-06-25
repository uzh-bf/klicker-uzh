import { useMutation, useSuspenseQuery } from '@apollo/client'
import { faTrashCan } from '@fortawesome/free-regular-svg-icons'
import { faKey } from '@fortawesome/free-solid-svg-icons'
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
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'
import DelegatedAccessCreationModal from './DelegatedAccessCreationModal'
import DelegatedAccessPassword, { PW_SETTINGS } from './DelegatedAccessPassword'
import DelegatedPasswordChangeModal from './DelegatedPasswordChangeModal'
import Setting from './Setting'

function DelegatedAccessSettings({ shortname }: { shortname?: string }) {
  const t = useTranslations()
  const [confirmationModal, setConfirmationModal] = useState(false)
  const [changePasswordModal, setChangePasswordModal] = useState<{
    open: boolean
    loginId?: string
  }>({ open: false, loginId: undefined })
  const { data: userLogins } = useSuspenseQuery(GetUserLoginsDocument)

  const [createUserLogin] = useMutation(CreateUserLoginDocument, {
    refetchQueries: [{ query: GetUserLoginsDocument }],
  })
  const [deleteUserLogin] = useMutation(DeleteUserLoginDocument, {
    refetchQueries: [{ query: GetUserLoginsDocument }],
  })

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
                'flex w-full flex-row justify-between rounded-md border border-solid px-2.5 py-1.5 shadow-sm'
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
              <div className="flex flex-row gap-1.5">
                <div className="mr-1 mt-auto text-sm text-neutral-500">
                  {login.lastLoginAt
                    ? t('manage.settings.lastUsed', {
                        date: dayjs(login.lastLoginAt).format('DD.MM.YYYY'),
                      })
                    : t('manage.settings.lastUsedNever')}
                </div>
                <Button
                  className={{ root: 'h-7 w-7' }}
                  onClick={() =>
                    setChangePasswordModal({
                      open: true,
                      loginId: login.id,
                    })
                  }
                  data={{ cy: `change-password-delegated-login-${login.name}` }}
                >
                  <Button.Icon withoutLabel icon={faKey} />
                </Button>
                <Button
                  destructive
                  className={{ root: 'h-7 w-7' }}
                  onClick={() =>
                    deleteUserLogin({ variables: { id: login.id } })
                  }
                  data={{ cy: `delete-delegated-login-${login.name}` }}
                >
                  <Button.Icon withoutLabel icon={faTrashCan} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className={(userLogins.userLogins?.length || 0) > 0 ? 'mt-5' : ''}>
          <H4 className={{ root: 'mb-0' }}>
            {t('manage.settings.createDelegatedLogin')}
          </H4>
          <Prose className={{ root: 'mb-3 max-w-none' }}>
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
            onSubmit={async (
              values,
              { resetForm, setFieldValue, setSubmitting, validateForm }
            ) => {
              setSubmitting(true)
              const result = await createUserLogin({
                variables: {
                  name: values.name,
                  password: values.password,
                  scope: values.scope,
                },
              })
              setSubmitting(false)
              setConfirmationModal(false)

              if (result.data?.createUserLogin) {
                resetForm()
                await setFieldValue(
                  'password',
                  generatePassword.generate(PW_SETTINGS)
                )
                await validateForm()
              }
            }}
          >
            {({ values, setFieldValue, isValid, isSubmitting, submitForm }) => {
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
                    <DelegatedAccessPassword
                      password={values.password}
                      setFieldValue={setFieldValue}
                    />
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
                      className={{
                        root: 'md:w-1/2',
                      }}
                      data={{ cy: 'delegated-login-scope' }}
                      required
                    />
                  </div>
                  <Button
                    primary
                    type="button"
                    disabled={!isValid || isSubmitting}
                    onClick={() => setConfirmationModal(true)}
                    className={{ root: 'float-right my-2' }}
                    data={{ cy: 'create-delegated-login' }}
                  >
                    <Button.Label>
                      {t('manage.settings.createLogin')}
                    </Button.Label>
                  </Button>
                  {confirmationModal && (
                    <DelegatedAccessCreationModal
                      onClose={() => setConfirmationModal(false)}
                      shortname={shortname ?? ''}
                      values={values}
                      isSubmitting={isSubmitting}
                      isValid={isValid}
                      submitForm={submitForm}
                    />
                  )}
                </Form>
              )
            }}
          </Formik>
        </div>
      </div>
      {changePasswordModal.open && (
        <DelegatedPasswordChangeModal
          loginId={changePasswordModal.loginId}
          onClose={() =>
            setChangePasswordModal({ open: false, loginId: undefined })
          }
        />
      )}
    </Setting>
  )
}

export default DelegatedAccessSettings
