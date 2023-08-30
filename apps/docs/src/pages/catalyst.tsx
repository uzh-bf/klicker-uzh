import Layout from '@theme/Layout'

function Catalyst() {
  return (
    <Layout>
      <div className="py-24">
        <div className="md:mx-auto max-w-7xl lg:px-8">
          <div className="max-w-4xl mx-auto sm:text-center">
            <h1 className="mt-2 text-5xl">
              <u className="decoration-[#3353b7]">Free</u> for personal use
            </h1>
          </div>
          <div className="max-w-xl mx-auto mt-6 text-2xl leading-tight text-muted sm:text-center">
            <p className="my-3 sm:my-0">
              We don't charge based on features or usage.
            </p>
            <p>Only pay if you use KlickerUZH as a bigger Institution.</p>
          </div>
          <div className="mt-20 mx-auto max-w-[45rem] flow-root">
            <div className="grid grid-cols-1 gap-6 -mt-8 cards isolate sm:max-w-sm sm:mx-auto lg:-mx-8 lg:mt-0 md:max-w-none md:grid-cols-2 xl:-mx-4">
              <div className="p-6 rounded-lg sm:rounded-xl sm:p-8 bg-slate-100">
                <h3 className="text-xl font-semibold leading-7">
                  Personal use
                </h3>
                <p className="flex items-baseline mt-6 gap-x-1">
                  <span className="text-4xl font-semibold tracking-tight md:text-5xl">
                    Free
                  </span>
                </p>
                <p>Free forever</p>
                <ul className="mt-8 mb-2 space-y-2">
                  <li class="flex gap-x-3">
                    <div>✅</div>
                    <div>bla</div>
                  </li>
                  <li class="flex gap-x-3">
                    <div>✅</div>
                    <div>bla</div>
                  </li>
                  <li class="flex gap-x-3">
                    <div>✅</div>
                    <div>bla</div>
                  </li>
                </ul>
              </div>

              <div className="p-6 rounded-lg sm:rounded-xl sm:p-8 bg-slate-100">
                <h3 className="text-xl font-semibold leading-7">
                  Institutional use
                </h3>
                <p className="flex items-baseline mt-6 gap-x-1">
                  <span className="text-4xl font-semibold tracking-tight md:text-5xl">
                    ⚡️Catalyst
                  </span>
                </p>
                <p>Support your Project as a catalyst</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Catalyst
