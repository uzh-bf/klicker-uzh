import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid } from 'semantic-ui-react'

import Footer from '../common/Footer'
import Navbar from '../../components/common/navbar/Navbar'
import Sidebar from '../../components/common/sidebar/Sidebar'
import initLogging from '../../lib/initLogging'
import withCSS from '../../lib/withCSS'

class TeacherLayout extends Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
    head: PropTypes.node.isRequired,
    intl: PropTypes.shape({ formatMessage: PropTypes.func.isRequired }),
    navbar: PropTypes.shape({
      accountShort: PropTypes.string.isRequired,
      search: PropTypes.shape({
        handleSearch: PropTypes.func.isRequired, // function that handles onChange for search field
        handleSort: PropTypes.func.isRequired, // function that handles changing of sort order
        query: PropTypes.string,
        sortBy: PropTypes.string,
        sortOrder: PropTypes.string,
      }),
      title: PropTypes.string.isRequired,
    }),
    sidebar: PropTypes.shape({
      activeItem: PropTypes.string.isRequired,
    }).isRequired,
  }

  static defaultProps = {
    intl: null,
    navbar: null,
    search: null,
  }

  state = {
    sidebarVisible: false,
  }

  componentWillMount() {
    // initialize sentry and logrocket (if appropriately configured)
    initLogging()
  }

  handleSidebarItemClick = (e, { name }) => {
    console.log(name)
    this.setState({ sidebarActiveItem: name })
  }

  handleSidebarToggle = () => {
    this.setState(prevState => ({ sidebarVisible: !prevState.sidebarVisible }))
  }

  render() {
    const { children, head, intl, navbar, sidebar } = this.props

    return (
      <Grid padded className="fullHeight">
        {head}

        {navbar &&
          <Navbar
            intl={intl}
            sidebarVisible={this.state.sidebarVisible}
            handleSidebarToggle={this.handleSidebarToggle}
            {...navbar}
          />}

        <Sidebar visible={this.state.sidebarVisible} {...sidebar}>
          {children}
        </Sidebar>

        <Footer />

        <style jsx global>{`
          * {
            // TODO: disable rounded corners in semantic itself
            border-radius: 0 !important;
          }

          .noPadding {
            padding: 0 !important;
          }

          // TODO: make the app entirely full height (100%)
          .fullHeight {
            min-height: 50rem;
          }
        `}</style>
      </Grid>
    )
  }
}

export default withCSS(TeacherLayout, ['reset', 'grid', 'menu', 'sidebar'])
