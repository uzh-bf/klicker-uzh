import Head from 'next/head'
import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Icon, Menu } from 'semantic-ui-react'

import BaseLayout from '../layouts/BaseLayout'

class Navbar extends Component {
  static propTypes = {
    defaultActive: PropTypes.string.isRequired,
  }

  state = {
    activeItem: null,
  }

  componentWillMount() {
    this.setState({ activeItem: this.props.defaultActive })
  }

  handleItemClick = (e, { name }) => {
    this.setState({ activeItem: name })
  }

  handleSidebarToggle = (e) => {
    console.log(e)
  }

  render() {
    const { activeItem } = this.state

    return (
      <BaseLayout>
        <Head>
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.10/components/icon.min.css"
          />
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.10/components/menu.min.css"
          />
        </Head>

        <Menu fluid as="nav">
          <Menu.Item
            name="sidebar"
            active={activeItem === 'sidebar'}
            icon
            onClick={this.handleSidebarToggle}
          >
            <Icon name="sidebar" />
          </Menu.Item>
          <Menu.Header as="h1" className="navbarTitle" content="hello world" />
          <Menu.Item
            name="bla"
            active={activeItem === 'bla'}
            onClick={this.handleItemClick}
            content="hello world"
          />
          <Menu.Item
            name="ble"
            active={activeItem === 'ble'}
            onClick={this.handleItemClick}
            content="lorem ipsum"
          />
        </Menu>
      </BaseLayout>
    )
  }
}

export default Navbar
