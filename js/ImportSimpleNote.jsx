import React, { Component } from 'react';
import * as action from './action.js';
import * as api from './api.js';

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

export default class ImportSimpleNote extends Component {
  constructor(props, context) {
    super(props, context);

    this.showHide = this.showHide.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleCloseFinished = this.handleCloseFinished.bind(this);
    this.handleImport = this.handleImport.bind(this);
    this.handleInputChanged = this.handleInputChanged.bind(this);
    this.checkStatus = this.checkStatus.bind(this);
    this.handleCheckStatusResp = this.handleCheckStatusResp.bind(this);

    this.inputValues = {};

    this.state = {
      isShowing: false,
      isImporting: false,
      importId: 0,
      finishedImporting: false,
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
    e.preventDefault();
    action.showHideImportSimpleNote(false);
  }

  handleCloseFinished(e) {
    console.log('ImportSimpleNote.handleCloseFinished()');
    e.preventDefault();
    action.showHideImportSimpleNote(false);
    // TODO: reload notes via action
  }

  handleInputChanged(e) {
    const id = e.target.id;
    const val = e.target.value;
    console.log(`ImportSimpleNote.handleClose: id=${id} val=${val}`);
    this.inputValues[id] = val;
  }

  scheduleCheckStatus(importId) {
    setTimeout(() => {
      this.checkStatus(importId);
    }, 1000);
  }

  handleCheckStatusResp(res) {
    console.log('handleCheckStatusResp: res=', res);
    if (res.Error) {
      this.setState({
        isImporting: false,
        errorMessage: res.Error
      });
      action.reloadNotes();
      return;
    }
    const n = res.ImportedCount;
    let msg = `Imported ${n} notes from SimpleNote`;
    const isImporting = !res.IsFinished;
    if (res.IsFinished) {
      msg = `Finished importing ${n} notes from SimpleNote`;
    }
    this.setState({
      finishedImporting: res.IsFinished,
      isImporting: isImporting,
      statusMessage: msg
    });
    if (res.IsFinished) {
      action.reloadNotes();
    } else {
      const importId = this.state.importId;
      this.scheduleCheckStatus(importId);
    }
  }

  checkStatus(importId) {
    api.statusImportSimpleNote(importId, this.handleCheckStatusResp, this.handleCheckStatusResp);
  }

  handleImport(e) {
    console.log('ImportSimpleNote.handleImport()');
    e.preventDefault();
    const email = this.inputValues['email'] || '';
    const pwd = this.inputValues['password'] || '';
    api.startfImportSimpleNote(email, pwd, res => {
      const importId = res.ImportID;
      this.setState({
        importId: importId,
        statusMessage: 'Imported 0 notes from SimpleNote',
        errorMessage: '',
        isImporting: true
      });
      this.scheduleCheckStatus(importId);
    }, resErr => {
      this.setState({
        errorMessage: resErr.Error
      });
    });
  }

  renderErrorMessage() {
    if (!this.state.errorMessage) {
      return null;
    }
    return (
      <tr>
        <td colSpan="2">
          <div className="error">
            { this.state.errorMessage }
          </div>
        </td>
      </tr>
      );
  }

  renderStatusMessage() {
    if (this.state.finishedImporting || !this.state.statusMessage) {
      return null;
    }
    return (
      <tr>
        <td colSpan="2">
          { this.state.statusMessage }
        </td>
      </tr>
      );
  }

  renderFormInner1() {
    if (this.state.finishedImporting) {
      return (
        <tr style={ styleMarginTop }>
          <td colSpan="2">
            { this.state.statusMessage }
          </td>
        </tr>
        );
    }

    return (
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
            name="email"
            onChange={ this.handleInputChanged } />
        </td>
      </tr>
      );
  }

  renderFormInner2() {
    if (this.state.finishedImporting) {
      return null;
    }

    return (
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
            name="password"
            onChange={ this.handleInputChanged } />
        </td>
      </tr>
      );
  }

  renderFormInner3() {
    if (this.state.finishedImporting) {
      return (
        <tr>
          <td></td>
          <td>
            <button className="btn btn-primary right no-margin-x" onClick={ this.handleCloseFinished }>
              Got It
            </button>
          </td>
        </tr>
        );
    }
    return (
      <tr>
        <td></td>
        <td>
          <button className="btn btn-primary right no-margin-x" onClick={ this.handleImport }>
            Import
          </button>
          { this.state.isImporting ?
            <i className="fa fa-spinner fa-pulse right" style={ styleSpinner }></i>
            : null }
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
    const formInner1 = this.renderFormInner1();
    const formInner2 = this.renderFormInner2();
    const formInner3 = this.renderFormInner3();

    //const isFinished = !this.state.finishedImporting;

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
              <form id="import-simplenote" method="GET">
                <table style={ styleTable }>
                  <tbody>
                    { formInner1 }
                    { formInner2 }
                    { formInner3 }
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
