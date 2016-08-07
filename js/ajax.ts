// port of https://github.com/yanatan16/nanoajax/blob/master/index.js
// to typescript
//
// Best place to find information on XHR features is:
// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest

import { Dict } from './utils';

export enum AjaxError {
  Failed = 0,
  Error = -1,
  Timeout = -2,
  Abort = -3
}

export interface Params {
  method?: "GET" | "PUT" | "POST";
  url: string;
  headers?: Dict<string>;
  body?: string | FormData;

  // passed to XMLHttpRequest
  responseType?: string;
  withCredentials?: boolean;
  timeout?: number;
  onprogress?: (ev: ProgressEvent) => any;
}

// Callback function prototype:
//  - statusCode from request or <= 0 if error, see AjaxError for possible errors
//  - response
//    + if responseType set and supported by browser, this is an object of some type (see docs)
//    + otherwise if request completed, this is the string text of the response

export interface AjaxCallback {
  (statusCode: number, response: any, request: XMLHttpRequest): void
}

function setXHRParams(req: XMLHttpRequest, params: Params) {
  if (params.responseType) {
    req.responseType = params.responseType;
  }
  if (params.withCredentials) {
    req.withCredentials = params.withCredentials;
  }
  if (params.timeout) {
    req.timeout = params.timeout;
  }
  if (params.onprogress) {
    req.onprogress = params.onprogress;
  }
}

export function ajax(params: Params, callback: AjaxCallback) {
  var req = new XMLHttpRequest();
  setXHRParams(req, params);

  let callbackWasCalled = false;
  function innerCb(statusCode: number, responseText?: string) {
    if (callbackWasCalled) {
      return;
    }
    const code = req.status === undefined ? statusCode : req.status;
    let rsp: any = "Error";
    if (req.status !== 0) {
      rsp = req.response || req.responseText || responseText;
    }
    callbackWasCalled = true;
    callback(code, rsp, req);
  }

  const body = params.body;
  const method = params.method || (body ? 'POST' : 'GET');
  req.open(method, params.url, true /* isAsync */);

  var cbSuccess = () => innerCb(200);
  req.onload = (ev: Event) => {
    cbSuccess();
  }

  req.onreadystatechange = (ev: ProgressEvent) => {
    if (req.readyState === 4) {
      cbSuccess();
    }
  }

  req.onerror = (ev: Event) => innerCb(AjaxError.Error, "Error");
  req.ontimeout = (ev: ProgressEvent) => innerCb(AjaxError.Timeout, "Timeout");
  req.onabort = (ev: Event) => innerCb(AjaxError.Abort, "Abort");

  const headers = params.headers || {};
  if (body) {
    setDefault(headers, 'X-Requested-With', 'XMLHttpRequest');

    if (!(body instanceof FormData)) {
      setDefault(headers, 'Content-Type', 'application/x-www-form-urlencoded');
    }
  }

  for (const hdrName in headers) {
    req.setRequestHeader(hdrName, headers[hdrName]);
  }

  req.send(body);
  return req;
}

function setDefault(obj: Dict<string>, key: string, value: string) {
  obj[key] = obj[key] || value
}
