// based on https://github.com/jashkenas/backbone/blob/master/backbone.js
// TODO: probably strip down everything we don't use, but is good for now
// TODO: this is not very react'y. There is react-router but looks very
// complicated

// Cached regex for stripping a leading hash/slash and trailing space.
var routeStripper = /^[#\/]|\s+$/g;

// Cached regex for stripping leading and trailing slashes.
var rootStripper = /^\/+|\/+$/g;

// Cached regex for stripping urls of hash.
var pathStripper = /#.*$/;

class Router {
  location: any;
  history: any;
  root: any;
  _usePushState: any;
  _wantsHashChange: any;
  options: any;
  _hasHashChange: any;
  _useHashChange: any;
  _wantsPushState: any;
  _hasPushState: any;
  fragment: any;
  iframe: any;

  constructor() {
    // Ensure that `History` can be used outside of the browser.
    if (typeof window !== 'undefined') {
      this.location = window.location;
      this.history = window.history;
    }
  }

  // Are we at the app root?
  atRoot() {
    var path = this.location.pathname.replace(/[^\/]$/, '$&/');
    return path === this.root && !this.getSearch();
  }

  // Unicode characters in `location.pathname` are percent encoded so they're
  // decoded for comparison. `%25` should not be decoded since it may be part
  // of an encoded parameter.
  decodeFragment(fragment: any) {
    return decodeURI(fragment.replace(/%25/g, '%2525'));
  }

  // In IE6, the hash fragment and search params are incorrect if the
  // fragment contains `?`.
  getSearch() {
    var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
    return match ? match[0] : '';
  }

  // Gets the true hash value. Cannot use location.hash directly due to bug
  // in Firefox where location.hash will always be decoded.
  getHash(window?: Window): any {
    var match = (window || this).location.href.match(/#(.*)$/);
    return match ? match[1] : '';
  }

  // Get the pathname and search params, without the root.
  getPath() {
    var path = this.decodeFragment(this.location.pathname + this.getSearch());
    var root = this.root.slice(0, -1);
    if (!path.indexOf(root)) path = path.slice(root.length);
    return path.charAt(0) === '/' ? path.slice(1) : path;
  }

  // Get the cross-browser normalized URL fragment from the path or hash.
  getFragment(fragment?: any): any {
    if (fragment == null) {
      if (this._usePushState || !this._wantsHashChange) {
        fragment = this.getPath();
      } else {
        fragment = this.getHash();
      }
    }
    return fragment.replace(routeStripper, '');
  }

  // Start the hash change handling, returning `true` if the current URL matches
  // an existing route, and `false` otherwise.
  start(options?: any) {
    // Figure out the initial configuration. Do we need an iframe?
    // Is pushState desired ... is it available?
    // TODO: was _.extend(), hope this is equivalent
    this.options = options || {};
    this.options.root = '/';

    this.root = this.options.root;
    this._wantsHashChange = this.options.hashChange !== false;
    this._hasHashChange = 'onhashchange' in window;
    this._useHashChange = this._wantsHashChange && this._hasHashChange;
    this._wantsPushState = !!this.options.pushState;
    this._hasPushState = !!(this.history && this.history.pushState);
    this._usePushState = this._wantsPushState && this._hasPushState;
    this.fragment = this.getFragment();

    // Normalize root to always include a leading and trailing slash.
    this.root = ('/' + this.root + '/').replace(rootStripper, '/');

    // Transition from hashChange to pushState or vice versa if both are
    // requested.
    if (this._wantsHashChange && this._wantsPushState) {
      // If we've started off with a route from a `pushState`-enabled
      // browser, but we're currently in a browser that doesn't support it...
      if (!this._hasPushState && !this.atRoot()) {
        var root = this.root.slice(0, -1) || '/';
        this.location.replace(root + '#' + this.getPath());
        // Return immediately as browser will do redirect to new url
        return true;

        // Or if we've started out with a hash-based route, but we're currently
        // in a browser where it could be `pushState`-based instead...
      } else if (this._hasPushState && this.atRoot()) {
        this.navigate(this.getHash(), {
          replace: true,
        });
      }
    }

    // Proxy an iframe to handle location events if the browser doesn't
    // support the `hashchange` event, HTML5 history, or the user wants
    // `hashChange` but not `pushState`.
    if (!this._hasHashChange && this._wantsHashChange && !this._usePushState) {
      var iframe = document.createElement('iframe');
      iframe.src = 'javascript:0';
      iframe.style.display = 'none';
      iframe.tabIndex = -1;
      var body = document.body;
      // Using `appendChild` will throw on IE < 9 if the document is not ready.
      this.iframe = body.insertBefore(iframe, body.firstChild) as HTMLFrameElement;
      this.iframe.contentWindow;
      this.iframe.document.open().close();
      this.iframe.location.hash = '#' + this.fragment;
    }
  }

  // Save a fragment into the hash history, or replace the URL state if the
  // 'replace' option is passed. You are responsible for properly URL-encoding
  // the fragment in advance.
  //
  // The options object can contain `trigger: true` if you wish to have the
  // route callback be fired (not usually desirable), or `replace: true`, if
  // you wish to modify the current URL without adding an entry to the history.
  navigate(fragment?: any, options?: any) {
    if (!options || options === true)
      options = {
        trigger: !!options,
      };

    // Normalize the fragment.
    fragment = this.getFragment(fragment || '');

    // Don't include a trailing slash on the root.
    var root = this.root;
    if (fragment === '' || fragment.charAt(0) === '?') {
      root = root.slice(0, -1) || '/';
    }
    var url = root + fragment;

    // Strip the hash and decode for matching.
    fragment = this.decodeFragment(fragment.replace(pathStripper, ''));

    if (this.fragment === fragment) return;
    this.fragment = fragment;

    // If pushState is available, we use it to set the fragment as a real URL.
    if (this._usePushState) {
      this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

      // If hash changes haven't been explicitly disabled, update the hash
      // fragment to store history.
    } else if (this._wantsHashChange) {
      this._updateHash(this.location, fragment, options.replace);
      if (this.iframe && fragment !== this.getHash(this.iframe)) {
        // Opening and closing the iframe tricks IE7 and earlier to push a
        // history entry on hash-tag change.  When replace is true, we don't
        // want this.
        if (!options.replace) this.iframe.document.open().close();
        this._updateHash(this.iframe.location, fragment, options.replace);
      }

      // If you've told us that you explicitly don't want fallback hashchange-
      // based history, then `navigate` becomes a page refresh.
    } else {
      return this.location.assign(url);
    }
  }

  // Update the hash location, either replacing the current entry, or adding
  // a new one to the browser history.
  _updateHash(location: any, fragment: any, replace: any) {
    if (replace) {
      var href = location.href.replace(/(javascript:|#).*$/, '');
      location.replace(href + '#' + fragment);
    } else {
      // Some browsers require that `hash` contains a leading #.
      location.hash = '#' + fragment;
    }
  }
}

let router = new Router();
router.start();

export default router;
