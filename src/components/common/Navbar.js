import Head from 'next/head'
import React, { Component } from 'react'
import { Menu } from 'semantic-ui-react'

import { BaseLayout } from '../layouts/BaseLayout'

class Navbar extends Component {
  state = {
    activeItem: 'bla',
  }

  render() {
    return (
      <BaseLayout>
        <Head>
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.10/components/menu.min.css"
          />
        </Head>
        <Menu fluid as="nav">
          <Menu.Item name="bla">hello world</Menu.Item>
          <Menu.Item name="ble">lorem ipsum</Menu.Item>
        </Menu>
      </BaseLayout>
    )
  }
}

export default Navbar
