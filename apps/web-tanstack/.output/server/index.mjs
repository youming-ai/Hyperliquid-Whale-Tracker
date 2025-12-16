globalThis.__nitro_main__ = import.meta.url;
import nodeHTTP from "node:http";
import { Readable } from "node:stream";
import nodeHTTPS from "node:https";
import nodeHTTP2 from "node:http2";
import { promises } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const services = {};
globalThis.__nitro_vite_envs__ = services;
function lazyInherit(target, source, sourceKey) {
  for (const key2 of [...Object.getOwnPropertyNames(source), ...Object.getOwnPropertySymbols(source)]) {
    if (key2 === "constructor") continue;
    const targetDesc = Object.getOwnPropertyDescriptor(target, key2);
    const desc = Object.getOwnPropertyDescriptor(source, key2);
    let modified = false;
    if (desc.get) {
      modified = true;
      desc.get = targetDesc?.get || function() {
        return this[sourceKey][key2];
      };
    }
    if (desc.set) {
      modified = true;
      desc.set = targetDesc?.set || function(value) {
        this[sourceKey][key2] = value;
      };
    }
    if (!targetDesc?.value && typeof desc.value === "function") {
      modified = true;
      desc.value = function(...args) {
        return this[sourceKey][key2](...args);
      };
    }
    if (modified) Object.defineProperty(target, key2, desc);
  }
}
const FastURL = /* @__PURE__ */ (() => {
  const NativeURL = globalThis.URL;
  const FastURL$1 = class URL {
    #url;
    #href;
    #protocol;
    #host;
    #pathname;
    #search;
    #searchParams;
    #pos;
    constructor(url) {
      if (typeof url === "string") this.#href = url;
      else {
        this.#protocol = url.protocol;
        this.#host = url.host;
        this.#pathname = url.pathname;
        this.#search = url.search;
      }
    }
    static [Symbol.hasInstance](val) {
      return val instanceof NativeURL;
    }
    get _url() {
      if (this.#url) return this.#url;
      this.#url = new NativeURL(this.href);
      this.#href = void 0;
      this.#protocol = void 0;
      this.#host = void 0;
      this.#pathname = void 0;
      this.#search = void 0;
      this.#searchParams = void 0;
      this.#pos = void 0;
      return this.#url;
    }
    get href() {
      if (this.#url) return this.#url.href;
      if (!this.#href) this.#href = `${this.#protocol || "http:"}//${this.#host || "localhost"}${this.#pathname || "/"}${this.#search || ""}`;
      return this.#href;
    }
    #getPos() {
      if (!this.#pos) {
        const url = this.href;
        const protoIndex = url.indexOf("://");
        const pathnameIndex = protoIndex === -1 ? -1 : url.indexOf("/", protoIndex + 4);
        this.#pos = [
          protoIndex,
          pathnameIndex,
          pathnameIndex === -1 ? -1 : url.indexOf("?", pathnameIndex)
        ];
      }
      return this.#pos;
    }
    get pathname() {
      if (this.#url) return this.#url.pathname;
      if (this.#pathname === void 0) {
        const [, pathnameIndex, queryIndex] = this.#getPos();
        if (pathnameIndex === -1) return this._url.pathname;
        this.#pathname = this.href.slice(pathnameIndex, queryIndex === -1 ? void 0 : queryIndex);
      }
      return this.#pathname;
    }
    get search() {
      if (this.#url) return this.#url.search;
      if (this.#search === void 0) {
        const [, pathnameIndex, queryIndex] = this.#getPos();
        if (pathnameIndex === -1) return this._url.search;
        const url = this.href;
        this.#search = queryIndex === -1 || queryIndex === url.length - 1 ? "" : url.slice(queryIndex);
      }
      return this.#search;
    }
    get searchParams() {
      if (this.#url) return this.#url.searchParams;
      if (!this.#searchParams) this.#searchParams = new URLSearchParams(this.search);
      return this.#searchParams;
    }
    get protocol() {
      if (this.#url) return this.#url.protocol;
      if (this.#protocol === void 0) {
        const [protocolIndex] = this.#getPos();
        if (protocolIndex === -1) return this._url.protocol;
        this.#protocol = this.href.slice(0, protocolIndex + 1);
      }
      return this.#protocol;
    }
    toString() {
      return this.href;
    }
    toJSON() {
      return this.href;
    }
  };
  lazyInherit(FastURL$1.prototype, NativeURL.prototype, "_url");
  Object.setPrototypeOf(FastURL$1.prototype, NativeURL.prototype);
  Object.setPrototypeOf(FastURL$1, NativeURL);
  return FastURL$1;
})();
function resolvePortAndHost(opts) {
  const _port = opts.port ?? globalThis.process?.env.PORT ?? 3e3;
  const port2 = typeof _port === "number" ? _port : Number.parseInt(_port, 10);
  if (port2 < 0 || port2 > 65535) throw new RangeError(`Port must be between 0 and 65535 (got "${port2}").`);
  return {
    port: port2,
    hostname: opts.hostname ?? globalThis.process?.env.HOST
  };
}
function fmtURL(host2, port2, secure) {
  if (!host2 || !port2) return;
  if (host2.includes(":")) host2 = `[${host2}]`;
  return `http${secure ? "s" : ""}://${host2}:${port2}/`;
}
function printListening(opts, url) {
  if (!url || (opts.silent ?? globalThis.process?.env?.TEST)) return;
  const _url = new URL(url);
  const allInterfaces = _url.hostname === "[::]" || _url.hostname === "0.0.0.0";
  if (allInterfaces) {
    _url.hostname = "localhost";
    url = _url.href;
  }
  let listeningOn = `➜ Listening on:`;
  let additionalInfo = allInterfaces ? " (all interfaces)" : "";
  if (globalThis.process.stdout?.isTTY) {
    listeningOn = `\x1B[32m${listeningOn}\x1B[0m`;
    url = `\x1B[36m${url}\x1B[0m`;
    additionalInfo = `\x1B[2m${additionalInfo}\x1B[0m`;
  }
  console.log(`${listeningOn} ${url}${additionalInfo}`);
}
function resolveTLSOptions(opts) {
  if (!opts.tls || opts.protocol === "http") return;
  const cert2 = resolveCertOrKey(opts.tls.cert);
  const key2 = resolveCertOrKey(opts.tls.key);
  if (!cert2 && !key2) {
    if (opts.protocol === "https") throw new TypeError("TLS `cert` and `key` must be provided for `https` protocol.");
    return;
  }
  if (!cert2 || !key2) throw new TypeError("TLS `cert` and `key` must be provided together.");
  return {
    cert: cert2,
    key: key2,
    passphrase: opts.tls.passphrase
  };
}
function resolveCertOrKey(value) {
  if (!value) return;
  if (typeof value !== "string") throw new TypeError("TLS certificate and key must be strings in PEM format or file paths.");
  if (value.startsWith("-----BEGIN ")) return value;
  const { readFileSync } = process.getBuiltinModule("node:fs");
  return readFileSync(value, "utf8");
}
function createWaitUntil() {
  const promises2 = /* @__PURE__ */ new Set();
  return {
    waitUntil: (promise) => {
      if (typeof promise?.then !== "function") return;
      promises2.add(Promise.resolve(promise).catch(console.error).finally(() => {
        promises2.delete(promise);
      }));
    },
    wait: () => {
      return Promise.all(promises2);
    }
  };
}
const noColor = /* @__PURE__ */ (() => {
  const env = globalThis.process?.env ?? {};
  return env.NO_COLOR === "1" || env.TERM === "dumb";
})();
const _c = (c, r = 39) => (t) => noColor ? t : `\x1B[${c}m${t}\x1B[${r}m`;
const red = /* @__PURE__ */ _c(31);
const gray = /* @__PURE__ */ _c(90);
function wrapFetch(server) {
  const fetchHandler = server.options.fetch;
  const middleware = server.options.middleware || [];
  return middleware.length === 0 ? fetchHandler : (request) => callMiddleware$1(request, fetchHandler, middleware, 0);
}
function callMiddleware$1(request, fetchHandler, middleware, index) {
  if (index === middleware.length) return fetchHandler(request);
  return middleware[index](request, () => callMiddleware$1(request, fetchHandler, middleware, index + 1));
}
const errorPlugin = (server) => {
  const errorHandler2 = server.options.error;
  if (!errorHandler2) return;
  server.options.middleware.unshift((_req, next) => {
    try {
      const res = next();
      return res instanceof Promise ? res.catch((error) => errorHandler2(error)) : res;
    } catch (error) {
      return errorHandler2(error);
    }
  });
};
const gracefulShutdownPlugin = (server) => {
  const config = server.options?.gracefulShutdown;
  if (!globalThis.process?.on || config === false || config === void 0 && (process.env.CI || process.env.TEST)) return;
  const gracefulShutdown = config === true || !config?.gracefulTimeout ? Number.parseInt(process.env.SERVER_SHUTDOWN_TIMEOUT || "") || 3 : config.gracefulTimeout;
  const forceShutdown = config === true || !config?.forceTimeout ? Number.parseInt(process.env.SERVER_FORCE_SHUTDOWN_TIMEOUT || "") || 5 : config.forceTimeout;
  let isShuttingDown = false;
  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    const w = process.stderr.write.bind(process.stderr);
    w(gray(`
Shutting down server in ${gracefulShutdown}s...`));
    let timeout;
    await Promise.race([server.close().finally(() => {
      clearTimeout(timeout);
      w(gray(" Server closed.\n"));
    }), new Promise((resolve2) => {
      timeout = setTimeout(() => {
        w(gray(`
Force closing connections in ${forceShutdown}s...`));
        timeout = setTimeout(() => {
          w(red("\nCould not close connections in time, force exiting."));
          resolve2();
        }, forceShutdown * 1e3);
        return server.close(true);
      }, gracefulShutdown * 1e3);
    })]);
    globalThis.process.exit(0);
  };
  for (const sig of ["SIGINT", "SIGTERM"]) globalThis.process.on(sig, shutdown);
};
const NodeResponse = /* @__PURE__ */ (() => {
  const NativeResponse = globalThis.Response;
  const STATUS_CODES = globalThis.process?.getBuiltinModule?.("node:http")?.STATUS_CODES || {};
  class NodeResponse$1 {
    #body;
    #init;
    #headers;
    #response;
    constructor(body, init) {
      this.#body = body;
      this.#init = init;
    }
    static [Symbol.hasInstance](val) {
      return val instanceof NativeResponse;
    }
    get status() {
      return this.#response?.status || this.#init?.status || 200;
    }
    get statusText() {
      return this.#response?.statusText || this.#init?.statusText || STATUS_CODES[this.status] || "";
    }
    get headers() {
      if (this.#response) return this.#response.headers;
      if (this.#headers) return this.#headers;
      const initHeaders = this.#init?.headers;
      return this.#headers = initHeaders instanceof Headers ? initHeaders : new Headers(initHeaders);
    }
    get ok() {
      if (this.#response) return this.#response.ok;
      const status = this.status;
      return status >= 200 && status < 300;
    }
    get _response() {
      if (this.#response) return this.#response;
      this.#response = new NativeResponse(this.#body, this.#headers ? {
        ...this.#init,
        headers: this.#headers
      } : this.#init);
      this.#init = void 0;
      this.#headers = void 0;
      this.#body = void 0;
      return this.#response;
    }
    _toNodeResponse() {
      const status = this.status;
      const statusText = this.statusText;
      let body;
      let contentType;
      let contentLength;
      if (this.#response) body = this.#response.body;
      else if (this.#body) if (this.#body instanceof ReadableStream) body = this.#body;
      else if (typeof this.#body === "string") {
        body = this.#body;
        contentType = "text/plain; charset=UTF-8";
        contentLength = Buffer.byteLength(this.#body);
      } else if (this.#body instanceof ArrayBuffer) {
        body = Buffer.from(this.#body);
        contentLength = this.#body.byteLength;
      } else if (this.#body instanceof Uint8Array) {
        body = this.#body;
        contentLength = this.#body.byteLength;
      } else if (this.#body instanceof DataView) {
        body = Buffer.from(this.#body.buffer);
        contentLength = this.#body.byteLength;
      } else if (this.#body instanceof Blob) {
        body = this.#body.stream();
        contentType = this.#body.type;
        contentLength = this.#body.size;
      } else if (typeof this.#body.pipe === "function") body = this.#body;
      else body = this._response.body;
      const headers2 = [];
      const initHeaders = this.#init?.headers;
      const headerEntries = this.#response?.headers || this.#headers || (initHeaders ? Array.isArray(initHeaders) ? initHeaders : initHeaders?.entries ? initHeaders.entries() : Object.entries(initHeaders).map(([k, v]) => [k.toLowerCase(), v]) : void 0);
      let hasContentTypeHeader;
      let hasContentLength;
      if (headerEntries) for (const [key2, value] of headerEntries) {
        if (Array.isArray(value)) for (const v of value) headers2.push([key2, v]);
        else headers2.push([key2, value]);
        if (key2 === "content-type") hasContentTypeHeader = true;
        else if (key2 === "content-length") hasContentLength = true;
      }
      if (contentType && !hasContentTypeHeader) headers2.push(["content-type", contentType]);
      if (contentLength && !hasContentLength) headers2.push(["content-length", String(contentLength)]);
      this.#init = void 0;
      this.#headers = void 0;
      this.#response = void 0;
      this.#body = void 0;
      return {
        status,
        statusText,
        headers: headers2,
        body
      };
    }
  }
  lazyInherit(NodeResponse$1.prototype, NativeResponse.prototype, "_response");
  Object.setPrototypeOf(NodeResponse$1, NativeResponse);
  Object.setPrototypeOf(NodeResponse$1.prototype, NativeResponse.prototype);
  return NodeResponse$1;
})();
async function sendNodeResponse(nodeRes, webRes) {
  if (!webRes) {
    nodeRes.statusCode = 500;
    return endNodeResponse(nodeRes);
  }
  if (webRes._toNodeResponse) {
    const res = webRes._toNodeResponse();
    writeHead(nodeRes, res.status, res.statusText, res.headers);
    if (res.body) {
      if (res.body instanceof ReadableStream) return streamBody(res.body, nodeRes);
      else if (typeof res.body?.pipe === "function") {
        res.body.pipe(nodeRes);
        return new Promise((resolve2) => nodeRes.on("close", resolve2));
      }
      nodeRes.write(res.body);
    }
    return endNodeResponse(nodeRes);
  }
  const rawHeaders = [...webRes.headers];
  writeHead(nodeRes, webRes.status, webRes.statusText, rawHeaders);
  return webRes.body ? streamBody(webRes.body, nodeRes) : endNodeResponse(nodeRes);
}
function writeHead(nodeRes, status, statusText, rawHeaders) {
  const writeHeaders = globalThis.Deno ? rawHeaders : rawHeaders.flat();
  if (!nodeRes.headersSent) if (nodeRes.req?.httpVersion === "2.0") nodeRes.writeHead(status, writeHeaders);
  else nodeRes.writeHead(status, statusText, writeHeaders);
}
function endNodeResponse(nodeRes) {
  return new Promise((resolve2) => nodeRes.end(resolve2));
}
function streamBody(stream, nodeRes) {
  if (nodeRes.destroyed) {
    stream.cancel();
    return;
  }
  const reader = stream.getReader();
  function streamCancel(error) {
    reader.cancel(error).catch(() => {
    });
    if (error) nodeRes.destroy(error);
  }
  function streamHandle({ done, value }) {
    try {
      if (done) nodeRes.end();
      else if (nodeRes.write(value)) reader.read().then(streamHandle, streamCancel);
      else nodeRes.once("drain", () => reader.read().then(streamHandle, streamCancel));
    } catch (error) {
      streamCancel(error instanceof Error ? error : void 0);
    }
  }
  nodeRes.on("close", streamCancel);
  nodeRes.on("error", streamCancel);
  reader.read().then(streamHandle, streamCancel);
  return reader.closed.catch(streamCancel).finally(() => {
    nodeRes.off("close", streamCancel);
    nodeRes.off("error", streamCancel);
  });
}
var NodeRequestURL = class extends FastURL {
  #req;
  constructor({ req }) {
    const path = req.url || "/";
    if (path[0] === "/") {
      const qIndex = path.indexOf("?");
      const pathname = qIndex === -1 ? path : path?.slice(0, qIndex) || "/";
      const search = qIndex === -1 ? "" : path?.slice(qIndex) || "";
      const host2 = req.headers.host || req.headers[":authority"] || `${req.socket.localFamily === "IPv6" ? "[" + req.socket.localAddress + "]" : req.socket.localAddress}:${req.socket?.localPort || "80"}`;
      const protocol = req.socket?.encrypted || req.headers["x-forwarded-proto"] === "https" || req.headers[":scheme"] === "https" ? "https:" : "http:";
      super({
        protocol,
        host: host2,
        pathname,
        search
      });
    } else super(path);
    this.#req = req;
  }
  get pathname() {
    return super.pathname;
  }
  set pathname(value) {
    this._url.pathname = value;
    this.#req.url = this._url.pathname + this._url.search;
  }
};
const NodeRequestHeaders = /* @__PURE__ */ (() => {
  const NativeHeaders = globalThis.Headers;
  class Headers2 {
    #req;
    #headers;
    constructor(req) {
      this.#req = req;
    }
    static [Symbol.hasInstance](val) {
      return val instanceof NativeHeaders;
    }
    get _headers() {
      if (!this.#headers) {
        const headers2 = new NativeHeaders();
        const rawHeaders = this.#req.rawHeaders;
        const len = rawHeaders.length;
        for (let i = 0; i < len; i += 2) {
          const key2 = rawHeaders[i];
          if (key2.charCodeAt(0) === 58) continue;
          const value = rawHeaders[i + 1];
          headers2.append(key2, value);
        }
        this.#headers = headers2;
      }
      return this.#headers;
    }
    get(name) {
      if (this.#headers) return this.#headers.get(name);
      const value = this.#req.headers[name.toLowerCase()];
      return Array.isArray(value) ? value.join(", ") : value || null;
    }
    has(name) {
      if (this.#headers) return this.#headers.has(name);
      return name.toLowerCase() in this.#req.headers;
    }
    getSetCookie() {
      if (this.#headers) return this.#headers.getSetCookie();
      const value = this.#req.headers["set-cookie"];
      return Array.isArray(value) ? value : value ? [value] : [];
    }
    *_entries() {
      const rawHeaders = this.#req.rawHeaders;
      const len = rawHeaders.length;
      for (let i = 0; i < len; i += 2) {
        const key2 = rawHeaders[i];
        if (key2.charCodeAt(0) === 58) continue;
        yield [key2.toLowerCase(), rawHeaders[i + 1]];
      }
    }
    entries() {
      return this.#headers ? this.#headers.entries() : this._entries();
    }
    [Symbol.iterator]() {
      return this.entries();
    }
  }
  lazyInherit(Headers2.prototype, NativeHeaders.prototype, "_headers");
  Object.setPrototypeOf(Headers2, NativeHeaders);
  Object.setPrototypeOf(Headers2.prototype, NativeHeaders.prototype);
  return Headers2;
})();
const NodeRequest = /* @__PURE__ */ (() => {
  const NativeRequest = globalThis[/* @__PURE__ */ Symbol.for("srvx.nativeRequest")] ??= globalThis.Request;
  const PatchedRequest = class Request$1 extends NativeRequest {
    static _srvx = true;
    static [Symbol.hasInstance](instance) {
      if (this === PatchedRequest) return instance instanceof NativeRequest;
      else return Object.prototype.isPrototypeOf.call(this.prototype, instance);
    }
    constructor(input, options) {
      if (typeof input === "object" && "_request" in input) input = input._request;
      if (options?.body?.getReader !== void 0) options.duplex ??= "half";
      super(input, options);
    }
  };
  if (!globalThis.Request._srvx) globalThis.Request = PatchedRequest;
  class Request2 {
    runtime;
    #req;
    #url;
    #bodyStream;
    #request;
    #headers;
    #abortController;
    constructor(ctx) {
      this.#req = ctx.req;
      this.runtime = {
        name: "node",
        node: ctx
      };
    }
    static [Symbol.hasInstance](val) {
      return val instanceof NativeRequest;
    }
    get ip() {
      return this.#req.socket?.remoteAddress;
    }
    get method() {
      if (this.#request) return this.#request.method;
      return this.#req.method || "GET";
    }
    get _url() {
      return this.#url ||= new NodeRequestURL({ req: this.#req });
    }
    set _url(url) {
      this.#url = url;
    }
    get url() {
      if (this.#request) return this.#request.url;
      return this._url.href;
    }
    get headers() {
      if (this.#request) return this.#request.headers;
      return this.#headers ||= new NodeRequestHeaders(this.#req);
    }
    get _abortController() {
      if (!this.#abortController) {
        this.#abortController = new AbortController();
        const { req, res } = this.runtime.node;
        const abortController = this.#abortController;
        const abort = (err) => abortController.abort?.(err);
        req.once("error", abort);
        if (res) res.once("close", () => {
          const reqError = req.errored;
          if (reqError) abort(reqError);
          else if (!res.writableEnded) abort();
        });
        else req.once("close", () => {
          if (!req.complete) abort();
        });
      }
      return this.#abortController;
    }
    get signal() {
      return this.#request ? this.#request.signal : this._abortController.signal;
    }
    get body() {
      if (this.#request) return this.#request.body;
      if (this.#bodyStream === void 0) {
        const method = this.method;
        this.#bodyStream = !(method === "GET" || method === "HEAD") ? Readable.toWeb(this.#req) : null;
      }
      return this.#bodyStream;
    }
    text() {
      if (this.#request) return this.#request.text();
      if (this.#bodyStream !== void 0) return this.#bodyStream ? new Response(this.#bodyStream).text() : Promise.resolve("");
      return readBody(this.#req).then((buf) => buf.toString());
    }
    json() {
      if (this.#request) return this.#request.json();
      return this.text().then((text) => JSON.parse(text));
    }
    get _request() {
      if (!this.#request) {
        this.#request = new PatchedRequest(this.url, {
          method: this.method,
          headers: this.headers,
          body: this.body,
          signal: this._abortController.signal
        });
        this.#headers = void 0;
        this.#bodyStream = void 0;
      }
      return this.#request;
    }
  }
  lazyInherit(Request2.prototype, NativeRequest.prototype, "_request");
  Object.setPrototypeOf(Request2.prototype, NativeRequest.prototype);
  return Request2;
})();
function readBody(req) {
  return new Promise((resolve2, reject) => {
    const chunks = [];
    const onData = (chunk) => {
      chunks.push(chunk);
    };
    const onError = (err) => {
      reject(err);
    };
    const onEnd = () => {
      req.off("error", onError);
      req.off("data", onData);
      resolve2(Buffer.concat(chunks));
    };
    req.on("data", onData).once("end", onEnd).once("error", onError);
  });
}
function serve(options) {
  return new NodeServer(options);
}
var NodeServer = class {
  runtime = "node";
  options;
  node;
  serveOptions;
  fetch;
  #isSecure;
  #listeningPromise;
  #wait;
  constructor(options) {
    this.options = {
      ...options,
      middleware: [...options.middleware || []]
    };
    for (const plugin of options.plugins || []) plugin(this);
    errorPlugin(this);
    gracefulShutdownPlugin(this);
    const fetchHandler = this.fetch = wrapFetch(this);
    this.#wait = createWaitUntil();
    const handler = (nodeReq, nodeRes) => {
      const request = new NodeRequest({
        req: nodeReq,
        res: nodeRes
      });
      request.waitUntil = this.#wait.waitUntil;
      const res = fetchHandler(request);
      return res instanceof Promise ? res.then((resolvedRes) => sendNodeResponse(nodeRes, resolvedRes)) : sendNodeResponse(nodeRes, res);
    };
    const tls = resolveTLSOptions(this.options);
    const { port: port2, hostname: host2 } = resolvePortAndHost(this.options);
    this.serveOptions = {
      port: port2,
      host: host2,
      exclusive: !this.options.reusePort,
      ...tls ? {
        cert: tls.cert,
        key: tls.key,
        passphrase: tls.passphrase
      } : {},
      ...this.options.node
    };
    let server;
    this.#isSecure = !!this.serveOptions.cert && this.options.protocol !== "http";
    if (this.options.node?.http2 ?? this.#isSecure) if (this.#isSecure) server = nodeHTTP2.createSecureServer({
      allowHTTP1: true,
      ...this.serveOptions
    }, handler);
    else throw new Error("node.http2 option requires tls certificate!");
    else if (this.#isSecure) server = nodeHTTPS.createServer(this.serveOptions, handler);
    else server = nodeHTTP.createServer(this.serveOptions, handler);
    this.node = {
      server,
      handler
    };
    if (!options.manual) this.serve();
  }
  serve() {
    if (this.#listeningPromise) return Promise.resolve(this.#listeningPromise).then(() => this);
    this.#listeningPromise = new Promise((resolve2) => {
      this.node.server.listen(this.serveOptions, () => {
        printListening(this.options, this.url);
        resolve2();
      });
    });
  }
  get url() {
    const addr = this.node?.server?.address();
    if (!addr) return;
    return typeof addr === "string" ? addr : fmtURL(addr.address, addr.port, this.#isSecure);
  }
  ready() {
    return Promise.resolve(this.#listeningPromise).then(() => this);
  }
  async close(closeAll) {
    await Promise.all([this.#wait.wait(), new Promise((resolve2, reject) => {
      const server = this.node?.server;
      if (!server) return resolve2();
      if (closeAll && "closeAllConnections" in server) server.closeAllConnections();
      server.close((error) => error ? reject(error) : resolve2());
    })]);
  }
};
const NullProtoObj = /* @__PURE__ */ (() => {
  const e = function() {
  };
  return e.prototype = /* @__PURE__ */ Object.create(null), Object.freeze(e.prototype), e;
})();
const kEventNS = "h3.internal.event.";
const kEventRes = /* @__PURE__ */ Symbol.for(`${kEventNS}res`);
const kEventResHeaders = /* @__PURE__ */ Symbol.for(`${kEventNS}res.headers`);
var H3Event = class {
  app;
  req;
  url;
  context;
  static __is_event__ = true;
  constructor(req, context, app) {
    this.context = context || req.context || new NullProtoObj();
    this.req = req;
    this.app = app;
    const _url = req._url;
    this.url = _url && _url instanceof URL ? _url : new FastURL(req.url);
  }
  get res() {
    return this[kEventRes] ||= new H3EventResponse();
  }
  get runtime() {
    return this.req.runtime;
  }
  waitUntil(promise) {
    this.req.waitUntil?.(promise);
  }
  toString() {
    return `[${this.req.method}] ${this.req.url}`;
  }
  toJSON() {
    return this.toString();
  }
  get node() {
    return this.req.runtime?.node;
  }
  get headers() {
    return this.req.headers;
  }
  get path() {
    return this.url.pathname + this.url.search;
  }
  get method() {
    return this.req.method;
  }
};
var H3EventResponse = class {
  status;
  statusText;
  get headers() {
    return this[kEventResHeaders] ||= new Headers();
  }
};
const DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
  return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
  if (!statusCode) return defaultStatusCode;
  if (typeof statusCode === "string") statusCode = +statusCode;
  if (statusCode < 100 || statusCode > 599) return defaultStatusCode;
  return statusCode;
}
var HTTPError = class HTTPError2 extends Error {
  get name() {
    return "HTTPError";
  }
  status;
  statusText;
  headers;
  cause;
  data;
  body;
  unhandled;
  static isError(input) {
    return input instanceof Error && input?.name === "HTTPError";
  }
  static status(status, statusText, details) {
    return new HTTPError2({
      ...details,
      statusText,
      status
    });
  }
  constructor(arg1, arg2) {
    let messageInput;
    let details;
    if (typeof arg1 === "string") {
      messageInput = arg1;
      details = arg2;
    } else details = arg1;
    const status = sanitizeStatusCode(details?.status || details?.cause?.status || details?.status || details?.statusCode, 500);
    const statusText = sanitizeStatusMessage(details?.statusText || details?.cause?.statusText || details?.statusText || details?.statusMessage);
    const message = messageInput || details?.message || details?.cause?.message || details?.statusText || details?.statusMessage || [
      "HTTPError",
      status,
      statusText
    ].filter(Boolean).join(" ");
    super(message, { cause: details });
    this.cause = details;
    Error.captureStackTrace?.(this, this.constructor);
    this.status = status;
    this.statusText = statusText || void 0;
    const rawHeaders = details?.headers || details?.cause?.headers;
    this.headers = rawHeaders ? new Headers(rawHeaders) : void 0;
    this.unhandled = details?.unhandled ?? details?.cause?.unhandled ?? void 0;
    this.data = details?.data;
    this.body = details?.body;
  }
  get statusCode() {
    return this.status;
  }
  get statusMessage() {
    return this.statusText;
  }
  toJSON() {
    const unhandled = this.unhandled;
    return {
      status: this.status,
      statusText: this.statusText,
      unhandled,
      message: unhandled ? "HTTPError" : this.message,
      data: unhandled ? void 0 : this.data,
      ...unhandled ? void 0 : this.body
    };
  }
};
function isJSONSerializable(value, _type) {
  if (value === null || value === void 0) return true;
  if (_type !== "object") return _type === "boolean" || _type === "number" || _type === "string";
  if (typeof value.toJSON === "function") return true;
  if (Array.isArray(value)) return true;
  if (typeof value.pipe === "function" || typeof value.pipeTo === "function") return false;
  if (value instanceof NullProtoObj) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
const kNotFound = /* @__PURE__ */ Symbol.for("h3.notFound");
const kHandled = /* @__PURE__ */ Symbol.for("h3.handled");
function toResponse(val, event, config = {}) {
  if (typeof val?.then === "function") return (val.catch?.((error) => error) || Promise.resolve(val)).then((resolvedVal) => toResponse(resolvedVal, event, config));
  const response = prepareResponse(val, event, config);
  if (typeof response?.then === "function") return toResponse(response, event, config);
  const { onResponse: onResponse$1 } = config;
  return onResponse$1 ? Promise.resolve(onResponse$1(response, event)).then(() => response) : response;
}
var HTTPResponse = class {
  #headers;
  #init;
  body;
  constructor(body, init) {
    this.body = body;
    this.#init = init;
  }
  get status() {
    return this.#init?.status || 200;
  }
  get statusText() {
    return this.#init?.statusText || "OK";
  }
  get headers() {
    return this.#headers ||= new Headers(this.#init?.headers);
  }
};
function prepareResponse(val, event, config, nested) {
  if (val === kHandled) return new NodeResponse(null);
  if (val === kNotFound) val = new HTTPError({
    status: 404,
    message: `Cannot find any route matching [${event.req.method}] ${event.url}`
  });
  if (val && val instanceof Error) {
    const isHTTPError = HTTPError.isError(val);
    const error = isHTTPError ? val : new HTTPError(val);
    if (!isHTTPError) {
      error.unhandled = true;
      if (val?.stack) error.stack = val.stack;
    }
    if (error.unhandled && !config.silent) console.error(error);
    const { onError: onError$1 } = config;
    return onError$1 && !nested ? Promise.resolve(onError$1(error, event)).catch((error$1) => error$1).then((newVal) => prepareResponse(newVal ?? val, event, config, true)) : errorResponse(error, config.debug);
  }
  const preparedRes = event[kEventRes];
  const preparedHeaders = preparedRes?.[kEventResHeaders];
  if (!(val instanceof Response)) {
    const res = prepareResponseBody(val, event, config);
    const status = res.status || preparedRes?.status;
    return new NodeResponse(nullBody(event.req.method, status) ? null : res.body, {
      status,
      statusText: res.statusText || preparedRes?.statusText,
      headers: res.headers && preparedHeaders ? mergeHeaders$1(res.headers, preparedHeaders) : res.headers || preparedHeaders
    });
  }
  if (!preparedHeaders || nested || !val.ok) return val;
  try {
    mergeHeaders$1(val.headers, preparedHeaders, val.headers);
    return val;
  } catch {
    return new NodeResponse(nullBody(event.req.method, val.status) ? null : val.body, {
      status: val.status,
      statusText: val.statusText,
      headers: mergeHeaders$1(val.headers, preparedHeaders)
    });
  }
}
function mergeHeaders$1(base, overrides, target = new Headers(base)) {
  for (const [name, value] of overrides) if (name === "set-cookie") target.append(name, value);
  else target.set(name, value);
  return target;
}
const frozenHeaders = () => {
  throw new Error("Headers are frozen");
};
var FrozenHeaders = class extends Headers {
  constructor(init) {
    super(init);
    this.set = this.append = this.delete = frozenHeaders;
  }
};
const emptyHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-length": "0" });
const jsonHeaders = /* @__PURE__ */ new FrozenHeaders({ "content-type": "application/json;charset=UTF-8" });
function prepareResponseBody(val, event, config) {
  if (val === null || val === void 0) return {
    body: "",
    headers: emptyHeaders
  };
  const valType = typeof val;
  if (valType === "string") return { body: val };
  if (val instanceof Uint8Array) {
    event.res.headers.set("content-length", val.byteLength.toString());
    return { body: val };
  }
  if (val instanceof HTTPResponse || val?.constructor?.name === "HTTPResponse") return val;
  if (isJSONSerializable(val, valType)) return {
    body: JSON.stringify(val, void 0, config.debug ? 2 : void 0),
    headers: jsonHeaders
  };
  if (valType === "bigint") return {
    body: val.toString(),
    headers: jsonHeaders
  };
  if (val instanceof Blob) {
    const headers2 = new Headers({
      "content-type": val.type,
      "content-length": val.size.toString()
    });
    let filename = val.name;
    if (filename) {
      filename = encodeURIComponent(filename);
      headers2.set("content-disposition", `filename="${filename}"; filename*=UTF-8''${filename}`);
    }
    return {
      body: val.stream(),
      headers: headers2
    };
  }
  if (valType === "symbol") return { body: val.toString() };
  if (valType === "function") return { body: `${val.name}()` };
  return { body: val };
}
function nullBody(method, status) {
  return method === "HEAD" || status === 100 || status === 101 || status === 102 || status === 204 || status === 205 || status === 304;
}
function errorResponse(error, debug) {
  return new NodeResponse(JSON.stringify({
    ...error.toJSON(),
    stack: debug && error.stack ? error.stack.split("\n").map((l) => l.trim()) : void 0
  }, void 0, debug ? 2 : void 0), {
    status: error.status,
    statusText: error.statusText,
    headers: error.headers ? mergeHeaders$1(jsonHeaders, error.headers) : new Headers(jsonHeaders)
  });
}
function callMiddleware(event, middleware, handler, index = 0) {
  if (index === middleware.length) return handler(event);
  const fn = middleware[index];
  let nextCalled;
  let nextResult;
  const next = () => {
    if (nextCalled) return nextResult;
    nextCalled = true;
    nextResult = callMiddleware(event, middleware, handler, index + 1);
    return nextResult;
  };
  const ret = fn(event, next);
  return isUnhandledResponse(ret) ? next() : typeof ret?.then === "function" ? ret.then((resolved) => isUnhandledResponse(resolved) ? next() : resolved) : ret;
}
function isUnhandledResponse(val) {
  return val === void 0 || val === kNotFound;
}
function defineHandler(input) {
  if (typeof input === "function") return handlerWithFetch(input);
  const handler = input.handler || (input.fetch ? function _fetchHandler(event) {
    return input.fetch(event.req);
  } : NoHandler);
  return Object.assign(handlerWithFetch(input.middleware?.length ? function _handlerMiddleware(event) {
    return callMiddleware(event, input.middleware, handler);
  } : handler), input);
}
function handlerWithFetch(handler) {
  if ("fetch" in handler) return handler;
  return Object.assign(handler, { fetch: (req) => {
    if (typeof req === "string") req = new URL(req, "http://_");
    if (req instanceof URL) req = new Request(req);
    const event = new H3Event(req);
    try {
      return Promise.resolve(toResponse(handler(event), event));
    } catch (error) {
      return Promise.resolve(toResponse(error, event));
    }
  } });
}
function defineLazyEventHandler(loader) {
  let handler;
  let promise;
  const resolveLazyHandler = () => {
    if (handler) return Promise.resolve(handler);
    return promise ??= Promise.resolve(loader()).then((r) => {
      handler = toEventHandler(r) || toEventHandler(r.default);
      if (typeof handler !== "function") throw new TypeError("Invalid lazy handler", { cause: { resolved: r } });
      return handler;
    });
  };
  return defineHandler(function lazyHandler(event) {
    return handler ? handler(event) : resolveLazyHandler().then((r) => r(event));
  });
}
function toEventHandler(handler) {
  if (typeof handler === "function") return handler;
  if (typeof handler?.handler === "function") return handler.handler;
  if (typeof handler?.fetch === "function") return function _fetchHandler(event) {
    return handler.fetch(event.req);
  };
}
const NoHandler = () => kNotFound;
var H3Core = class {
  config;
  "~middleware";
  "~routes" = [];
  constructor(config = {}) {
    this["~middleware"] = [];
    this.config = config;
    this.fetch = this.fetch.bind(this);
    this.handler = this.handler.bind(this);
  }
  fetch(request) {
    return this["~request"](request);
  }
  handler(event) {
    const route = this["~findRoute"](event);
    if (route) {
      event.context.params = route.params;
      event.context.matchedRoute = route.data;
    }
    const routeHandler = route?.data.handler || NoHandler;
    const middleware = this["~getMiddleware"](event, route);
    return middleware.length > 0 ? callMiddleware(event, middleware, routeHandler) : routeHandler(event);
  }
  "~request"(request, context) {
    const event = new H3Event(request, context, this);
    let handlerRes;
    try {
      if (this.config.onRequest) {
        const hookRes = this.config.onRequest(event);
        handlerRes = typeof hookRes?.then === "function" ? hookRes.then(() => this.handler(event)) : this.handler(event);
      } else handlerRes = this.handler(event);
    } catch (error) {
      handlerRes = Promise.reject(error);
    }
    return toResponse(handlerRes, event, this.config);
  }
  "~findRoute"(_event) {
  }
  "~addRoute"(_route) {
    this["~routes"].push(_route);
  }
  "~getMiddleware"(_event, route) {
    const routeMiddleware = route?.data.middleware;
    const globalMiddleware2 = this["~middleware"];
    return routeMiddleware ? [...globalMiddleware2, ...routeMiddleware] : globalMiddleware2;
  }
};
const errorHandler$1 = (error, event) => {
  const res = defaultHandler(error, event);
  return new NodeResponse(typeof res.body === "string" ? res.body : JSON.stringify(res.body, null, 2), res);
};
function defaultHandler(error, event, opts) {
  const isSensitive = error.unhandled;
  const status = error.status || 500;
  const url = event.url || new URL(event.req.url);
  if (status === 404) {
    const baseURL = "/";
    if (/^\/[^/]/.test(baseURL) && !url.pathname.startsWith(baseURL)) {
      const redirectTo = `${baseURL}${url.pathname.slice(1)}${url.search}`;
      return {
        status: 302,
        statusText: "Found",
        headers: { location: redirectTo },
        body: `Redirecting...`
      };
    }
  }
  if (isSensitive && !opts?.silent) {
    const tags = [error.unhandled && "[unhandled]"].filter(Boolean).join(" ");
    console.error(`[request error] ${tags} [${event.req.method}] ${url}
`, error);
  }
  const headers2 = {
    "content-type": "application/json",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "script-src 'none'; frame-ancestors 'none';"
  };
  if (status === 404 || !event.res.headers.has("cache-control")) {
    headers2["cache-control"] = "no-cache";
  }
  const body = {
    error: true,
    url: url.href,
    status,
    statusText: error.statusText,
    message: isSensitive ? "Server Error" : error.message,
    data: isSensitive ? void 0 : error.data
  };
  return {
    status,
    statusText: error.statusText,
    headers: headers2,
    body
  };
}
const errorHandlers = [errorHandler$1];
async function errorHandler(error, event) {
  for (const handler of errorHandlers) {
    try {
      const response = await handler(error, event, { defaultHandler });
      if (response) {
        return response;
      }
    } catch (error2) {
      console.error(error2);
    }
  }
}
const ENC_SLASH_RE = /%2f/gi;
function decode(text = "") {
  try {
    return decodeURIComponent("" + text);
  } catch {
    return "" + text;
  }
}
function decodePath(text) {
  return decode(text.replace(ENC_SLASH_RE, "%252F"));
}
const JOIN_LEADING_SLASH_RE = /^\.?\//;
function hasTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return input.endsWith("/");
  }
}
function withoutTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || "/";
  }
}
function withTrailingSlash(input = "", respectQueryAndFragment) {
  {
    return input.endsWith("/") ? input : input + "/";
  }
}
function hasLeadingSlash(input = "") {
  return input.startsWith("/");
}
function withLeadingSlash(input = "") {
  return hasLeadingSlash(input) ? input : "/" + input;
}
function isNonEmptyURL(url) {
  return url && url !== "/";
}
function joinURL(base, ...input) {
  let url = base || "";
  for (const segment of input.filter((url2) => isNonEmptyURL(url2))) {
    if (url) {
      const _segment = segment.replace(JOIN_LEADING_SLASH_RE, "");
      url = withTrailingSlash(url) + _segment;
    } else {
      url = segment;
    }
  }
  return url;
}
const headers = ((m) => function headersRouteRule(event) {
  for (const [key2, value] of Object.entries(m.options || {})) {
    event.res.headers.set(key2, value);
  }
});
const assets = {
  "/_headers": {
    "type": "text/plain; charset=utf-8",
    "etag": '"bf-uvAaCfG2Tb76PlruxJjuqUbnYbA"',
    "mtime": "2025-12-16T08:01:16.321Z",
    "size": 191,
    "path": "../public/_headers"
  },
  "/_redirects": {
    "type": "text/plain; charset=utf-8",
    "etag": '"18-+oL+Es1XZdIOibUzsrl9W9r73L0"',
    "mtime": "2025-12-16T08:01:16.321Z",
    "size": 24,
    "path": "../public/_redirects"
  },
  "/favicon.ico": {
    "type": "image/vnd.microsoft.icon",
    "etag": '"f1e-ESBTjHetHyiokkO0tT/irBbMO8Y"',
    "mtime": "2025-12-16T08:01:16.322Z",
    "size": 3870,
    "path": "../public/favicon.ico"
  },
  "/logo192.png": {
    "type": "image/png",
    "etag": '"14e3-f08taHgqf6/O2oRVTsq5tImHdQA"',
    "mtime": "2025-12-16T08:01:16.322Z",
    "size": 5347,
    "path": "../public/logo192.png"
  },
  "/logo512.png": {
    "type": "image/png",
    "etag": '"25c0-RpFfnQJpTtSb/HqVNJR2hBA9w/4"',
    "mtime": "2025-12-16T08:01:16.323Z",
    "size": 9664,
    "path": "../public/logo512.png"
  },
  "/manifest.json": {
    "type": "application/json",
    "etag": '"1f2-Oqn/x1R1hBTtEjA8nFhpBeFJJNg"',
    "mtime": "2025-12-16T08:01:16.323Z",
    "size": 498,
    "path": "../public/manifest.json"
  },
  "/robots.txt": {
    "type": "text/plain; charset=utf-8",
    "etag": '"43-BEzmj4PuhUNHX+oW9uOnPSihxtU"',
    "mtime": "2025-12-16T08:01:16.323Z",
    "size": 67,
    "path": "../public/robots.txt"
  },
  "/tanstack-circle-logo.png": {
    "type": "image/png",
    "etag": '"40cab-HZ1KcYPs7tRjLe4Sd4g6CwKW+W8"',
    "mtime": "2025-12-16T08:01:16.324Z",
    "size": 265387,
    "path": "../public/tanstack-circle-logo.png"
  },
  "/tanstack-word-logo-white.svg": {
    "type": "image/svg+xml",
    "etag": '"3a9a-9TQFm/pN8AZe1ZK0G1KyCEojnYg"',
    "mtime": "2025-12-16T08:01:16.324Z",
    "size": 15002,
    "path": "../public/tanstack-word-logo-white.svg"
  },
  "/assets/Arc-VDBY7LNS-BChRXCXW.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"19de-GUfGsdtMhTyDtjXMPNDmN5gQ4Bg"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 6622,
    "path": "../public/assets/Arc-VDBY7LNS-BChRXCXW.js"
  },
  "/assets/Brave-BRAKJXDS-mq-Xo37j.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"10a4-4Ao2mysYjGMozaxOzVwdxhRRV2o"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 4260,
    "path": "../public/assets/Brave-BRAKJXDS-mq-Xo37j.js"
  },
  "/assets/Browser-76IHF3Y2-BMhRaC5Z.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"2e30-WGUiJHFElX9dRzjJoIpLNYpywgk"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 11824,
    "path": "../public/assets/Browser-76IHF3Y2-BMhRaC5Z.js"
  },
  "/assets/Chrome-65Q5P54Y-DR9MQEVr.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"6bb-dqvupCJZ0hSIOZha/7vk3Qn8rZ4"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1723,
    "path": "../public/assets/Chrome-65Q5P54Y-DR9MQEVr.js"
  },
  "/assets/Edge-XSPUTORV-DEoZslQE.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"16bc-EHfyXX6tetUYL3qZauuTMrcAlmk"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 5820,
    "path": "../public/assets/Edge-XSPUTORV-DEoZslQE.js"
  },
  "/assets/Firefox-AAHGJQIP-Bp_Hm04m.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"3b55-p53qMcsPoepDA8Ar8G5NAH/kj+M"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 15189,
    "path": "../public/assets/Firefox-AAHGJQIP-Bp_Hm04m.js"
  },
  "/assets/Linux-OO4TNCLJ-B0aw93n9.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"163fe-AdSQ2bNfVA5kV0R82RPMJIwNuGM"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 91134,
    "path": "../public/assets/Linux-OO4TNCLJ-B0aw93n9.js"
  },
  "/assets/Macos-MW4AE7LN-Vvm8Drw3.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"c210-GKEWfbeQaDIHAwGYhCVpe5QHwjk"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 49680,
    "path": "../public/assets/Macos-MW4AE7LN-Vvm8Drw3.js"
  },
  "/assets/Opera-KQZLSACL-Cwv5MDFy.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"830-b21RkN22CwzrIQOHVwZzNyaqgPA"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 2096,
    "path": "../public/assets/Opera-KQZLSACL-Cwv5MDFy.js"
  },
  "/assets/Safari-ZPL37GXR-C4Ggg6rz.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"35b7-DnCTSo7yO0q7snBbeX5q1W/Fcus"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 13751,
    "path": "../public/assets/Safari-ZPL37GXR-C4Ggg6rz.js"
  },
  "/assets/Windows-PPTHQER6-BlyV2p7Y.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"20c-uD45q73DkSdIUM3Yltk8464aqxE"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 524,
    "path": "../public/assets/Windows-PPTHQER6-BlyV2p7Y.js"
  },
  "/assets/_address-lJTtzXqt.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"50d3-VBxhwvraSLrFUz75xXFs1zXKhYs"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 20691,
    "path": "../public/assets/_address-lJTtzXqt.js"
  },
  "/assets/_id-C1kGiW2H.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"1429-FrPcMMSSXJB3NDuzc9MJlcz/SIg"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 5161,
    "path": "../public/assets/_id-C1kGiW2H.js"
  },
  "/assets/apechain-SX5YFU6N-q5qBv-mp.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"5b3-0YuE8Rs899K9fO6ZEL8Q65UiNx8"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 1459,
    "path": "../public/assets/apechain-SX5YFU6N-q5qBv-mp.js"
  },
  "/assets/ar_AR-44JUQ6EW-BMX-am0v.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"10fed-nB16739plpTV2ykl/+7zOA67w/I"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 69613,
    "path": "../public/assets/ar_AR-44JUQ6EW-BMX-am0v.js"
  },
  "/assets/arbitrum-WURIBY6W-CqVkHBr5.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a1f-nEfUTwz8S1ch5zUUPy2k45pXoh0"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 2591,
    "path": "../public/assets/arbitrum-WURIBY6W-CqVkHBr5.js"
  },
  "/assets/assets-Q6ZU7ZJ5-P8HioiAD.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"5c43-tCAz8hUCTiAIvw1eAy64sN9M2VM"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 23619,
    "path": "../public/assets/assets-Q6ZU7ZJ5-P8HioiAD.js"
  },
  "/assets/avalanche-KOMJD3XY-Dsn_JPR4.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"4f4-/tjr2Ub6ffmmOAnvAG8Sizc1ZFs"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 1268,
    "path": "../public/assets/avalanche-KOMJD3XY-Dsn_JPR4.js"
  },
  "/assets/base-OAXLRA4F-CoYTVIiL.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"25c-ZelEE0UDllJ6ytDPHzafKpCMXT0"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 604,
    "path": "../public/assets/base-OAXLRA4F-CoYTVIiL.js"
  },
  "/assets/berachain-NJECWIVC-DumxnFvf.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ec0-7nsHM/ux0aGTQcro2Pre1qABLsQ"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 3776,
    "path": "../public/assets/berachain-NJECWIVC-DumxnFvf.js"
  },
  "/assets/blast-V555OVXZ-BbhJh1tj.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"686-3mB4h3nCcLksjjig6+v/iZTmNqY"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 1670,
    "path": "../public/assets/blast-V555OVXZ-BbhJh1tj.js"
  },
  "/assets/bsc-N647EYR2-B2nLKXWV.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"633-o4lnG1hVye8Dx0g6d5IF2GdjOUM"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 1587,
    "path": "../public/assets/bsc-N647EYR2-B2nLKXWV.js"
  },
  "/assets/ccip-B_vv9b3f.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a32-sc4Of8HjTizkSGtv25dHlnTJyKw"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 2610,
    "path": "../public/assets/ccip-B_vv9b3f.js"
  },
  "/assets/celo-GEP4TUHG-CenIBYLU.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"1fe-7jQHE0SW6Qi0vys23N9gYCS08eI"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 510,
    "path": "../public/assets/celo-GEP4TUHG-CenIBYLU.js"
  },
  "/assets/connect-UA7M4XW6-IY3X6Bmr.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"dd9-ZFiCw/x+LbsIUPvEgdx06hmRr5o"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 3545,
    "path": "../public/assets/connect-UA7M4XW6-IY3X6Bmr.js"
  },
  "/assets/connectors_false-CjAqUxIK.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"5e-Kk/orYCoZaSeDSfZdMJuBHoK0AI"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 94,
    "path": "../public/assets/connectors_false-CjAqUxIK.js"
  },
  "/assets/connectors_false-K89u2u_D.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"6a-DCUh+It1bh8WsmrhS64SFzf7eog"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 106,
    "path": "../public/assets/connectors_false-K89u2u_D.js"
  },
  "/assets/create-FASO7PVG-D_rvSpre.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"10e8-2myzNdqKxkBT1wx3omRgHtzN5YY"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 4328,
    "path": "../public/assets/create-FASO7PVG-D_rvSpre.js"
  },
  "/assets/cronos-HJPAQTAE-BEOvlOC4.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"5f0-FjCXkJZqc3WZIvvWZbHsBBWftjQ"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1520,
    "path": "../public/assets/cronos-HJPAQTAE-BEOvlOC4.js"
  },
  "/assets/dashboard-D4JK1vdd.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"1b38-cmk+bojO3CpJ9mT88T+TqIa4Rek"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 6968,
    "path": "../public/assets/dashboard-D4JK1vdd.js"
  },
  "/assets/de_DE-PYAO5YD6-BWlqPWgO.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ff72-egB2sGewbkcUfcLGSLQoIUnduZY"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 65394,
    "path": "../public/assets/de_DE-PYAO5YD6-BWlqPWgO.js"
  },
  "/assets/degen-FQQ4XGHB-CeHTs88l.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"5ce-W4RX7ybytFd58kFs4daZIAooK9o"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1486,
    "path": "../public/assets/degen-FQQ4XGHB-CeHTs88l.js"
  },
  "/assets/es_419-HRGOJ6VT-D-qzxUM-.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"eb89-g3qmHnjBlnK8drt2xZnJLC+xHP4"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 60297,
    "path": "../public/assets/es_419-HRGOJ6VT-D-qzxUM-.js"
  },
  "/assets/ethereum-RGGVA4PY-SWGOlkuk.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"55d-e6JA0Yc3jSlPqoTm+I/u9otdTg4"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 1373,
    "path": "../public/assets/ethereum-RGGVA4PY-SWGOlkuk.js"
  },
  "/assets/flow-5FQJFCTK-CUie2reO.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"360-xa7hYg1MAD7ObRhI3jOC6/O7NqI"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 864,
    "path": "../public/assets/flow-5FQJFCTK-CUie2reO.js"
  },
  "/assets/fr_FR-IGGVC6RM-D8LpUM75.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"10207-hhsKlNhsBbx39Nqvuk78BZhETEk"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 66055,
    "path": "../public/assets/fr_FR-IGGVC6RM-D8LpUM75.js"
  },
  "/assets/gnosis-37ZC4RBL-B137OtHZ.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"704-QePVrj9gTx9lNM1xFeYIK1FUBUE"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1796,
    "path": "../public/assets/gnosis-37ZC4RBL-B137OtHZ.js"
  },
  "/assets/gravity-J5YQHTYH-Bj6B0uod.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"602-ZKqsWYQ7Q1R6RlWCvURTcyS4+ec"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1538,
    "path": "../public/assets/gravity-J5YQHTYH-Bj6B0uod.js"
  },
  "/assets/hardhat-TX56IT5N-CV1FY-wE.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"1068-SnZXml1XhtOO51Tm/9kB5UPw3E8"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 4200,
    "path": "../public/assets/hardhat-TX56IT5N-CV1FY-wE.js"
  },
  "/assets/hi_IN-XSKAA3MF-C3QUpWyP.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"1a5dd-oddFBoicOAEKNnBYXAKHNp/hPL8"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 107997,
    "path": "../public/assets/hi_IN-XSKAA3MF-C3QUpWyP.js"
  },
  "/assets/hyperevm-VKPAA4SA-CHwraEsx.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"2d5-77tqIK9efx11+AKcXQ9kiTvEo9s"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 725,
    "path": "../public/assets/hyperevm-VKPAA4SA-CHwraEsx.js"
  },
  "/assets/id_ID-KUOB4UAL-K9y-nRWm.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"e5c2-nhqV5G9+BodSjIB8OYw3XWHrUXc"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 58818,
    "path": "../public/assets/id_ID-KUOB4UAL-K9y-nRWm.js"
  },
  "/assets/index-0kjvysxi.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"8fd-AZO53ZO4HV5sp72i0QraTa5TG+k"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 2301,
    "path": "../public/assets/index-0kjvysxi.js"
  },
  "/assets/index-4iwR3ORy.css": {
    "type": "text/css; charset=utf-8",
    "etag": '"b8f9-VKaCsumuehCQHfTNV3cSrViaTcQ"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 47353,
    "path": "../public/assets/index-4iwR3ORy.css"
  },
  "/assets/index-C26YNV-i.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"efd-uJ712+JxxIrvFDsbUVfqFQFUL74"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 3837,
    "path": "../public/assets/index-C26YNV-i.js"
  },
  "/assets/index-VxbsqYbG.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"e8a0b-P7rpDueHy7Z9+me85P3YV9mhUsQ"',
    "mtime": "2025-12-16T08:01:16.615Z",
    "size": 952843,
    "path": "../public/assets/index-VxbsqYbG.js"
  },
  "/assets/index-sxNZRNti.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"e73f-F6s2COakpq9FysXM2fcdtZJGoiI"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 59199,
    "path": "../public/assets/index-sxNZRNti.js"
  },
  "/assets/ink-FZMYZWHG-62p-5IK5.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"566-NmNIpbklI1OgVcFX3lg3ciMW6NA"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1382,
    "path": "../public/assets/ink-FZMYZWHG-62p-5IK5.js"
  },
  "/assets/ja_JP-4WRQ63RX-Ct5pF4ug.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"1196e-+MCefIg1Hlg4KA3rlvxN3FX8W3Q"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 72046,
    "path": "../public/assets/ja_JP-4WRQ63RX-Ct5pF4ug.js"
  },
  "/assets/kaia-65D2U3PU-JmuLQ4gC.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"5c9-XTAeQklv0t5AcsmNn1BjO1TjVhc"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1481,
    "path": "../public/assets/kaia-65D2U3PU-JmuLQ4gC.js"
  },
  "/assets/ko_KR-I2K7AIEP-B5gw8Mwb.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"f9e8-Vy9vx8oyvo+KNJo17QaqU1IJIcw"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 63976,
    "path": "../public/assets/ko_KR-I2K7AIEP-B5gw8Mwb.js"
  },
  "/assets/linea-QRMVQ5DY-DuI3vv0d.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"41a-Xv+0CTDbydJftIu9+k5g/U/zdr4"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1050,
    "path": "../public/assets/linea-QRMVQ5DY-DuI3vv0d.js"
  },
  "/assets/login-UP3DZBGS-Db_wM5oQ.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"2edb-hpCfS/iIffqrFHYFiv+7FFupYN0"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 11995,
    "path": "../public/assets/login-UP3DZBGS-Db_wM5oQ.js"
  },
  "/assets/manta-SI27YFEJ-CpVOKa06.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"c7f-Mt/3Z0y5Qgyf6m/yK7DOsUXZmdc"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 3199,
    "path": "../public/assets/manta-SI27YFEJ-CpVOKa06.js"
  },
  "/assets/mantle-CKIUT334-DR2WgqzU.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"1495-csZ81gp9kx18wVxhqG7YrsZX9O8"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 5269,
    "path": "../public/assets/mantle-CKIUT334-DR2WgqzU.js"
  },
  "/assets/monad-4KWC6TSS-DVXSkpiz.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"2e3-+ZnYmDgGed84mikFw82PMctsVbs"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 739,
    "path": "../public/assets/monad-4KWC6TSS-DVXSkpiz.js"
  },
  "/assets/ms_MY-6VZW6Q3Z-BtFD07hR.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"e902-TfYIjotXSVOo5j6kyNqWi0IzjCQ"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 59650,
    "path": "../public/assets/ms_MY-6VZW6Q3Z-BtFD07hR.js"
  },
  "/assets/new-CPmPtlDk.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"16cc-CnYw+A6g0G+svoQZT4vx6Z6VVz0"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 5836,
    "path": "../public/assets/new-CPmPtlDk.js"
  },
  "/assets/optimism-HAF2GUT7-ec6Nqxs9.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"2d8-yWLdaHFTl1qlI6shwSWV22EhkPE"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 728,
    "path": "../public/assets/optimism-HAF2GUT7-ec6Nqxs9.js"
  },
  "/assets/polygon-WW6ZI7PM-DXlmm4L1.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"5fa-0Ijvck5MyGZsVR/EC1QYl8JTskI"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1530,
    "path": "../public/assets/polygon-WW6ZI7PM-DXlmm4L1.js"
  },
  "/assets/pt_BR-N3XOZ4SV-CvVpfsHb.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"ea37-1URuRMGLqrBD5By+tkDxI4fMvWY"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 59959,
    "path": "../public/assets/pt_BR-N3XOZ4SV-CvVpfsHb.js"
  },
  "/assets/refresh-S4T5V5GX-CwqIaaxK.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"bbc-o0aj4B5vsY4rXh44aljtZf/xf8M"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 3004,
    "path": "../public/assets/refresh-S4T5V5GX-CwqIaaxK.js"
  },
  "/assets/ronin-EMCPYXZT-N-QBHZdV.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a6d-TW1KZ0B65gH46HnAL1H1k9cT520"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 2669,
    "path": "../public/assets/ronin-EMCPYXZT-N-QBHZdV.js"
  },
  "/assets/ru_RU-IITAPRET-DOj6Jzj7.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"15ad5-cJIqpgTCCPF0liINKqYOWfzGATk"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 88789,
    "path": "../public/assets/ru_RU-IITAPRET-DOj6Jzj7.js"
  },
  "/assets/sanko-RHQYXGM5-OX010CbN.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"55a5-y4C9vaQaneJKvEGvVIXtsejBTLg"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 21925,
    "path": "../public/assets/sanko-RHQYXGM5-OX010CbN.js"
  },
  "/assets/scan-4UYSQ56Q-CjMz6-XC.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"11ea-IwrSR7JBrhyjamFhD1uTbHUXXag"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 4586,
    "path": "../public/assets/scan-4UYSQ56Q-CjMz6-XC.js"
  },
  "/assets/scroll-5OBGQVOV-DJFECiai.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a48-hTOQIXOPocmTNZSA+isPi7IuAOk"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 2632,
    "path": "../public/assets/scroll-5OBGQVOV-DJFECiai.js"
  },
  "/assets/sign-A7IJEUT5-CGsRnPrd.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"15ad-KAEWNlj5FFPoyFMj4KIZInG3TBQ"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 5549,
    "path": "../public/assets/sign-A7IJEUT5-CGsRnPrd.js"
  },
  "/assets/superposition-HG6MMR2Y-bRkgatRO.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"3dc-xojyHn5h3g70aoU/yXR0rHQcwOE"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 988,
    "path": "../public/assets/superposition-HG6MMR2Y-bRkgatRO.js"
  },
  "/assets/th_TH-3ZQCKCQE-BcHUN2Q4.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"19682-u/Ws96H+GpuvWes9Si+edwJmpDg"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 104066,
    "path": "../public/assets/th_TH-3ZQCKCQE-BcHUN2Q4.js"
  },
  "/assets/tr_TR-QUPUGMUF-CwpF6ZFn.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"f21c-XpciLePN1CdCaDViNXDZO5bOweM"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 61980,
    "path": "../public/assets/tr_TR-QUPUGMUF-CwpF6ZFn.js"
  },
  "/assets/uk_UA-SSN6SV5E-IlYYyRC6.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"154bc-MGQ36eBT+DQ/xpo0I7OT8cJDnqY"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 87228,
    "path": "../public/assets/uk_UA-SSN6SV5E-IlYYyRC6.js"
  },
  "/assets/unichain-C5BWO2ZY-BfguYsnu.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"3d8-Dae5qrLyc20v1yok0yXjzqPv2MA"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 984,
    "path": "../public/assets/unichain-C5BWO2ZY-BfguYsnu.js"
  },
  "/assets/utils-BN7U-suI.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"4f0e-AKssHouj3Xsmx/Mb5oaisrjzJts"',
    "mtime": "2025-12-16T08:01:16.614Z",
    "size": 20238,
    "path": "../public/assets/utils-BN7U-suI.js"
  },
  "/assets/vi_VN-7BUVRNYY-CZ9S75qZ.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"10769-d2HjHGiatmgsc2vnW057nvENcpA"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 67433,
    "path": "../public/assets/vi_VN-7BUVRNYY-CZ9S75qZ.js"
  },
  "/assets/xdc-KJ3TDBYO-DNV6zchh.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"51f-es6/zu3OXSAuXq6zVCsHenpdDfM"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1311,
    "path": "../public/assets/xdc-KJ3TDBYO-DNV6zchh.js"
  },
  "/assets/zetachain-TLDS5IPW-Udhyw16T.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"255-5nhXlTVGCmKI7uN1VNxf/S0c1lY"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 597,
    "path": "../public/assets/zetachain-TLDS5IPW-Udhyw16T.js"
  },
  "/assets/zh_CN-HJBN674C-Baf0GEeT.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"d0e6-zKkIT1xGkoLlAs3rosPRaQTrfgo"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 53478,
    "path": "../public/assets/zh_CN-HJBN674C-Baf0GEeT.js"
  },
  "/assets/zh_HK-JW3WLRKE-VztJKXL5.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"d443-sxmu9eVOu0i8714K31jQsv34NUc"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 54339,
    "path": "../public/assets/zh_HK-JW3WLRKE-VztJKXL5.js"
  },
  "/assets/zh_TW-VNNRNXY7-aWfg7Qp4.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"d0e8-+xZ+1otiFJ7uXQHavIcXpnvqK8I"',
    "mtime": "2025-12-16T08:01:16.612Z",
    "size": 53480,
    "path": "../public/assets/zh_TW-VNNRNXY7-aWfg7Qp4.js"
  },
  "/assets/zksync-DH7HK5U4-Dt4usFw6.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"459-JoCLbcakgSiFOBJRcHDlzlOfDjU"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 1113,
    "path": "../public/assets/zksync-DH7HK5U4-Dt4usFw6.js"
  },
  "/assets/zora-FYL5H3IO-iB4wygST.js": {
    "type": "text/javascript; charset=utf-8",
    "etag": '"a79-7lXrbqy9mfJa7PkZFoDKX26F10w"',
    "mtime": "2025-12-16T08:01:16.613Z",
    "size": 2681,
    "path": "../public/assets/zora-FYL5H3IO-iB4wygST.js"
  }
};
function readAsset(id) {
  const serverDir = dirname(fileURLToPath(globalThis.__nitro_main__));
  return promises.readFile(resolve(serverDir, assets[id].path));
}
const publicAssetBases = {};
function isPublicAssetURL(id = "") {
  if (assets[id]) {
    return true;
  }
  for (const base in publicAssetBases) {
    if (id.startsWith(base)) {
      return true;
    }
  }
  return false;
}
function getAsset(id) {
  return assets[id];
}
const METHODS = /* @__PURE__ */ new Set(["HEAD", "GET"]);
const EncodingMap = {
  gzip: ".gz",
  br: ".br"
};
const _G4783H = defineHandler((event) => {
  if (event.req.method && !METHODS.has(event.req.method)) {
    return;
  }
  let id = decodePath(withLeadingSlash(withoutTrailingSlash(event.url.pathname)));
  let asset;
  const encodingHeader = event.req.headers.get("accept-encoding") || "";
  const encodings = [...encodingHeader.split(",").map((e) => EncodingMap[e.trim()]).filter(Boolean).sort(), ""];
  if (encodings.length > 1) {
    event.res.headers.append("Vary", "Accept-Encoding");
  }
  for (const encoding of encodings) {
    for (const _id of [id + encoding, joinURL(id, "index.html" + encoding)]) {
      const _asset = getAsset(_id);
      if (_asset) {
        asset = _asset;
        id = _id;
        break;
      }
    }
  }
  if (!asset) {
    if (isPublicAssetURL(id)) {
      event.res.headers.delete("Cache-Control");
      throw new HTTPError({ status: 404 });
    }
    return;
  }
  const ifNotMatch = event.req.headers.get("if-none-match") === asset.etag;
  if (ifNotMatch) {
    event.res.status = 304;
    event.res.statusText = "Not Modified";
    return "";
  }
  const ifModifiedSinceH = event.req.headers.get("if-modified-since");
  const mtimeDate = new Date(asset.mtime);
  if (ifModifiedSinceH && asset.mtime && new Date(ifModifiedSinceH) >= mtimeDate) {
    event.res.status = 304;
    event.res.statusText = "Not Modified";
    return "";
  }
  if (asset.type) {
    event.res.headers.set("Content-Type", asset.type);
  }
  if (asset.etag && !event.res.headers.has("ETag")) {
    event.res.headers.set("ETag", asset.etag);
  }
  if (asset.mtime && !event.res.headers.has("Last-Modified")) {
    event.res.headers.set("Last-Modified", mtimeDate.toUTCString());
  }
  if (asset.encoding && !event.res.headers.has("Content-Encoding")) {
    event.res.headers.set("Content-Encoding", asset.encoding);
  }
  if (asset.size > 0 && !event.res.headers.has("Content-Length")) {
    event.res.headers.set("Content-Length", asset.size.toString());
  }
  return readAsset(id);
});
const findRouteRules = /* @__PURE__ */ (() => {
  const $0 = [{ name: "headers", route: "/assets/**", handler: headers, options: { "cache-control": "public, max-age=31536000, immutable" } }];
  return (m, p) => {
    let r = [];
    if (p.charCodeAt(p.length - 1) === 47) p = p.slice(0, -1) || "/";
    let s = p.split("/");
    s.length - 1;
    if (s[1] === "assets") {
      r.unshift({ data: $0, params: { "_": s.slice(2).join("/") } });
    }
    return r;
  };
})();
const _lazy_xDaQha = defineLazyEventHandler(() => Promise.resolve().then(function() {
  return rendererTemplate;
}));
const findRoute = /* @__PURE__ */ (() => {
  const data = { route: "/**", handler: _lazy_xDaQha };
  return ((_m, p) => {
    return { data, params: { "_": p.slice(1) } };
  });
})();
const globalMiddleware = [
  toEventHandler(_G4783H)
].filter(Boolean);
function useNitroApp() {
  return useNitroApp.__instance__ ??= initNitroApp();
}
function initNitroApp() {
  const nitroApp2 = createNitroApp();
  globalThis.__nitro__ = nitroApp2;
  return nitroApp2;
}
function createNitroApp() {
  const hooks = void 0;
  const captureError = (error, errorCtx) => {
    if (errorCtx?.event) {
      const errors = errorCtx.event.req.context?.nitro?.errors;
      if (errors) {
        errors.push({
          error,
          context: errorCtx
        });
      }
    }
  };
  const h3App = createH3App({ onError(error, event) {
    return errorHandler(error, event);
  } });
  let appHandler = (req) => {
    req.context ||= {};
    req.context.nitro = req.context.nitro || { errors: [] };
    return h3App.fetch(req);
  };
  const app = {
    fetch: appHandler,
    h3: h3App,
    hooks,
    captureError
  };
  return app;
}
function createH3App(config) {
  const h3App = new H3Core(config);
  h3App["~findRoute"] = (event) => findRoute(event.req.method, event.url.pathname);
  h3App["~middleware"].push(...globalMiddleware);
  {
    h3App["~getMiddleware"] = (event, route) => {
      const pathname = event.url.pathname;
      const method = event.req.method;
      const middleware = [];
      {
        const routeRules = getRouteRules(method, pathname);
        event.context.routeRules = routeRules?.routeRules;
        if (routeRules?.routeRuleMiddleware.length) {
          middleware.push(...routeRules.routeRuleMiddleware);
        }
      }
      middleware.push(...h3App["~middleware"]);
      if (route?.data?.middleware?.length) {
        middleware.push(...route.data.middleware);
      }
      return middleware;
    };
  }
  return h3App;
}
function getRouteRules(method, pathname) {
  const m = findRouteRules(method, pathname);
  if (!m?.length) {
    return { routeRuleMiddleware: [] };
  }
  const routeRules = {};
  for (const layer of m) {
    for (const rule of layer.data) {
      const currentRule = routeRules[rule.name];
      if (currentRule) {
        if (rule.options === false) {
          delete routeRules[rule.name];
          continue;
        }
        if (typeof currentRule.options === "object" && typeof rule.options === "object") {
          currentRule.options = {
            ...currentRule.options,
            ...rule.options
          };
        } else {
          currentRule.options = rule.options;
        }
        currentRule.route = rule.route;
        currentRule.params = {
          ...currentRule.params,
          ...layer.params
        };
      } else if (rule.options !== false) {
        routeRules[rule.name] = {
          ...rule,
          params: layer.params
        };
      }
    }
  }
  const middleware = [];
  for (const rule of Object.values(routeRules)) {
    if (rule.options === false || !rule.handler) {
      continue;
    }
    middleware.push(rule.handler(rule));
  }
  return {
    routeRules,
    routeRuleMiddleware: middleware
  };
}
function _captureError(error, type) {
  console.error(`[${type}]`, error);
  useNitroApp().captureError?.(error, { tags: [type] });
}
function trapUnhandledErrors() {
  process.on("unhandledRejection", (error) => _captureError(error, "unhandledRejection"));
  process.on("uncaughtException", (error) => _captureError(error, "uncaughtException"));
}
const port = Number.parseInt(process.env.NITRO_PORT || process.env.PORT || "") || 3e3;
const host = process.env.NITRO_HOST || process.env.HOST;
const cert = process.env.NITRO_SSL_CERT;
const key = process.env.NITRO_SSL_KEY;
const nitroApp = useNitroApp();
serve({
  port,
  hostname: host,
  tls: cert && key ? {
    cert,
    key
  } : void 0,
  fetch: nitroApp.fetch
});
trapUnhandledErrors();
const nodeServer = {};
const rendererTemplate$1 = () => new HTTPResponse('<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <link rel="icon" href="/favicon.ico" />\n    <meta name="theme-color" content="#000000" />\n    <meta\n      name="description"\n      content="Web site created using create-tsrouter-app"\n    />\n    <link rel="apple-touch-icon" href="/logo192.png" />\n    <link rel="manifest" href="/manifest.json" />\n    <title>Create TanStack App - web-tanstack</title>\n    <script type="module" crossorigin src="/assets/index-VxbsqYbG.js"><\/script>\n    <link rel="stylesheet" crossorigin href="/assets/index-4iwR3ORy.css">\n  </head>\n  <body>\n    <div id="app"></div>\n  </body>\n</html>\n', { headers: { "content-type": "text/html; charset=utf-8" } });
function renderIndexHTML(event) {
  return rendererTemplate$1(event.req);
}
const rendererTemplate = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  default: renderIndexHTML
});
export {
  nodeServer as default
};
