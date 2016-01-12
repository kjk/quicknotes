import React, { Component } from 'react';
import * as action from './action.js';

export default class ImportSimpleNote extends Component {
  constructor(props, context) {
    super(props, context);

    this.showHide = this.showHide.bind(this);
    this.handleClose = this.handleClose.bind(this);

    this.state = {
      isShowing: false,
      isImporting: false,
      errorMessage: null,
      statusMessage: null
    };
  }

  componentDidMount() {
    action.onShowHideImportSimpleNote(this.showHide, this);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  showHide(shouldShow) {
    console.log('ImportSimpleNote.showHide: shouldShow: ", shouldShow');
    this.setState({
      isShowing: shouldShow
    });
  }

  handleClose(e) {
    console.log('ImportSimpleNote.handleClose()');
    action.showHideImportSimpleNote(false);
  }

  renderErrorMessage() {
    if (!this.state.errorMessage) {
      return null;
    }
    return (
      <tr>
        <td colSpan="2">
          <div className="error">
            There was an error! A really long error message.
          </div>
        </td>
      </tr>
      );
  }

  renderStatusMessage() {
    if (!this.state.statusMessage) {
      return null;
    }
    return (
      <tr>
        <td colSpan="2">
          Imported 17 notes.
        </td>
      </tr>
      );
  }

  render() {
    if (!this.state.isShowing) {
      return (
        <div id="no-import-simple-note" className="hidden">
        </div>
        );
    }

    const statusMessage = this.renderStatusMessage();
    const errorMessage = this.renderErrorMessage();

    const style100 = {
      width: '100%'
    };

    const styleTable = {
      minWidth: 480,
      marginLeft: 'auto',
      marginRight: 'auto'
    };

    const stylePadRight = {
      paddingRight: 8
    };

    const styleMarginTop = {
      marginTop: 8
    };

    const styleSpinner = {
      textAlign: 'center',
      fontSize: 19,
      paddingTop: 4,
      paddingBottom: 3,
      marginRight: 8
    };

    return (
      <div className="modal">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <button type="button"
                className="close"
                data-dismiss="modal"
                onClick={ this.handleClose }>
                <span>×</span>
              </button>
              <h4 className="modal-title">Import notes from SimpleNote.com</h4>
            </div>
            <div className="modal-body">
              <form id="import-simplenote" action="/importsimplenote" method="GET">
                <table style={ styleTable }>
                  <tbody>
                    <tr>
                      <td>
                        <label style={ stylePadRight } htmlFor="email">
                          Email
                        </label>
                      </td>
                      <td>
                        <input style={ style100 }
                          type="text"
                          id="email"
                          name="email" />
                      </td>
                    </tr>
                    <tr style={ styleMarginTop }>
                      <td>
                        <label htmlFor="password">
                          Password
                        </label>
                      </td>
                      <td>
                        <input style={ style100 }
                          type="password"
                          id="password"
                          name="password" />
                      </td>
                    </tr>
                    <tr>
                      <td></td>
                      <td>
                        <button className="btn btn-primary right no-margin-x">
                          Import
                        </button>
                        { this.state.isImporting ?
                          <i className="fa fa-spinner fa-pulse right" style={ styleSpinner }></i>
                          : null }
                      </td>
                    </tr>
                    { statusMessage }
                    { errorMessage }
                  </tbody>
                </table>
              </form>
              <div className="status">
              </div>
            </div>
          </div>
        </div>
      </div>
      );
  }
}
