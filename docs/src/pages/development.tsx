import React from 'react'
import Layout from '@theme/Layout'
import { ArrowRightIcon } from '@heroicons/react/solid'

import UserForm from '../components/UserForm'
import CustomButton from '../components/common/CustomButton'

const Development = () => {
  return (
    <Layout title="Development">
      <div className="max-w-6xl p-8 m-auto">
        <div className="mb-4 text-5xl font-bold">
          Development - Get Involved
        </div>
        <div className="flex flex-row justify-between h-12 mb-4">
          <div className="text-3xl font-bold">P-8 "Digital Skills"</div>
          <div className="hidden h-full md:block">
            <img
              src="/img/logo_swissuniversities.png"
              className="h-full mr-2"
            />
            <img src="/img/logo_uzh.jpeg" className="h-full" />
          </div>
        </div>
        <div className="mb-10">
          As part of a project backed by swissuniversities and the Teaching
          Center at the Dept. of Banking and Finance (UZH), the KlickerUZH team
          will be working on several interesting focus areas over the coming
          years. We will be developing best practices and materials, as well as
          extending the KlickerUZH with capabilities that support each of these
          areas. This page and our official documentation will be continuously
          extended with helpful resources.
          <div className="block mt-4 md:hidden">
            <img src="/img/logo_swissuniversities.png" className="h-12 mr-2" />
            <img src="/img/logo_uzh.jpeg" className="h-12" />
          </div>
        </div>
        <div className="flex flex-col mb-8 md:mb-12 md:flex-row">
          <div className="w-full md:w-1/2">
            <div className="mb-4 text-3xl font-bold">User Group</div>
            <div className="mr-0 md:mr-8">
              We strive to develop our roadmap and goals based on the needs of
              our users. The goal of our project on "Digital Skills" is to
              improve your capabilities in the area of digital interactions. If
              you are interested in classroom interaction and would like to be
              involved in future developments, we welcome you to join our
              KlickerUZH user group with the following form.
            </div>
            <div className="mb-8 mr-0 -ml-4 md:mb-0 md:mr-4">
              <UserForm />
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <div className="mb-4 text-3xl font-bold">Public Roadmap</div>
            <div className="mb-4">
              In order to simplify the workflow and to enable interaction with
              our user community, a public roadmap is available on Feedbear
              allowing you to see what we are currently working on. The same
              platform also enables you to submit feature requests and bug
              reports, as well as to like inputs from other users. This helps us
              to prioritize features requested more often by our users.
            </div>
            <CustomButton
              text={
                <div>
                  <ArrowRightIcon className="h-5 mr-2 align-text-bottom" />
                  Roadmap on Feedbear
                </div>
              }
              link="https://klicker-uzh.feedbear.com/boards/feature-requests"
              className="px-4 ml-0 w-max"
            />
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Development
