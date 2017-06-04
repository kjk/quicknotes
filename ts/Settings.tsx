import React from 'react';
import * as ReactDOM from 'react-dom';
import * as action from './action';

const allThemes = ['light', 'dark'];

const allLayouts = ['default', 'grid', 'compact'];

interface State {
  isShowing?: boolean;
  theme?: any;
  layout?: any;
}

export default class Settings extends React.Component<any, State> {
  constructor(props?: any, context?: any) {
    super(props, context);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleLayoutChanged = this.handleLayoutChanged.bind(this);
    this.handleOk = this.handleOk.bind(this);
    this.handleThemeChanged = this.handleThemeChanged.bind(this);
    this.showHide = this.showHide.bind(this);

    this.state = {
      isShowing: false,
      theme: 'light',
      layout: 'default',
    };
  }

  componentDidMount() {
    action.onShowHideSettings(this.showHide, this);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  showHide(shouldShow: boolean) {
    console.log('Settings.showHide: shouldShow: ", shouldShow');
    this.setState({
      isShowing: shouldShow,
    });
  }

  handleThemeChanged(e: any) {
    const theme = e.target.value;
    console.log('handleThemeChanged: ', theme);
    this.setState({
      theme: theme,
    });
    document.body.className = 'theme-' + theme;
  }

  handleLayoutChanged(e: any) {
    const layout = e.target.value;
    console.log('handleLayoutChanged: ', layout);
    this.setState({
      layout: layout,
    });
    document.body.setAttribute('data-spacing', layout);
  }

  renderThemesSelect(themes: any, selected: any) {
    const options = themes.map(function(theme: any) {
      return (
        <option key={theme}>
          {theme}
        </option>
      );
    });
    return (
      <select value={selected} onChange={this.handleThemeChanged}>
        {options}
      </select>
    );
  }

  renderLayoutsSelect(layouts: any, selected: any) {
    const options = layouts.map(function(layout: any) {
      return (
        <option key={layout}>
          {layout}
        </option>
      );
    });
    return (
      <select value={selected} onChange={this.handleLayoutChanged}>
        {options}
      </select>
    );
  }

  handleOk(e: any) {
    e.preventDefault();
    action.hideSettings();
  }

  handleCancel(e: any) {
    e.preventDefault();
    action.hideSettings();
  }

  render() {
    //console.log('Settings.render');
    if (!this.state.isShowing) {
      return <div id="settings" className="hidden" />;
    }
    const layouts = this.renderLayoutsSelect(allLayouts, this.state.layout);
    const themes = this.renderThemesSelect(allThemes, this.state.theme);
    return (
      <div id="settings">
        <div className="settings-div">
          Layout:
          {layouts}
        </div>
        <div className="settings-div">
          Theme:
          {themes}
        </div>
        <div className="settings-buttons">
          <button onClick={this.handleOk}>
            Ok
          </button>
          <button onClick={this.handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
}
