const tough = require('tough-cookie');
const Promise = require('bluebird');

const Store = tough.Store;
const permuteDomain = tough.permuteDomain;
const permutePath = tough.permutePath;
const pathMatch = tough.pathMatch;
const dynamodb = require('./dynamodb');
const util = require('util');


const saveToDB = async (data, cb) => {
  const dataJson = JSON.stringify(data);
  await dynamodb.handler.getInstance().putCookiesForUser(dataJson);
  cb();
}

const loadFromDB = async (cb) => {
  const data = await dynamodb.handler.getInstance().getCookiesForUser();
  const dataJson = data ? JSON.parse(data) : null;
  for (const domainName in dataJson) {
    for (const pathName in dataJson[domainName]) {
      for (const cookieName in dataJson[domainName][pathName]) {
        dataJson[domainName][pathName][cookieName] = tough.fromJSON(JSON.stringify(dataJson[domainName][pathName][cookieName]));
      }
    }
  }
  cb(dataJson);
}

class DynamoDBCookieStore extends Store {
  constructor() {
    super()
    this.idx = {}; // idx is memory cache
    this.initialized = false;
  }

  async init() {
    await loadFromDB(dataJson => {
      if (dataJson)
        this.idx = dataJson;
    });
    this.initialized = true;
  }
  // force a default depth:
  async inspect() {
    if (!this.initialized) await this.init();
    return `{ idx: ${util.inspect(this.idx, false, 2)} }`;
  }

  async findCookie(domain, path, key, cb) {
    if (!this.initialized) await this.init();
    if (!this.idx[domain]) {
      return cb(null, undefined);
    }
    if (!this.idx[domain][path]) {
      return cb(null, undefined);
    }
    return cb(null, this.idx[domain][path][key] || null);
  }

  async findCookies(domain, path, cb) {
    if (!this.initialized) await this.init();
    const results = [];
    if (!domain) {
      return cb(null, []);
    }

    let pathMatcher;
    if (!path) {
      // null or '/' means "all paths"
      pathMatcher = (domainIndex) => {
        for (const curPath in domainIndex) {
          const pathIndex = domainIndex[curPath];
          for (const key in pathIndex) {
            results.push(pathIndex[key]);
          }
        }
      };

    } else if (path === '/') {
      pathMatcher = (domainIndex) => {
        const pathIndex = domainIndex['/'];
        if (!pathIndex) {
          return;
        }
        for (const key in pathIndex) {
          results.push(pathIndex[key]);
        }
      };

    } else {
      const paths = permutePath(path) || [path];
      pathMatcher = (domainIndex) => {
        paths.forEach(curPath => {
          const pathIndex = domainIndex[curPath];
          if (!pathIndex) {
            return;
          }
          for (const key in pathIndex) {
            results.push(pathIndex[key]);
          }
        });
      };
    }

    const domains = permuteDomain(domain) || [domain];
    const idx = this.idx;
    domains.forEach(curDomain => {
      const domainIndex = idx[curDomain];
      if (!domainIndex) {
        return;
      }
      pathMatcher(domainIndex);
    });

    cb(null, results);
  }

  async putCookie(cookie, cb) {
    if (!this.initialized) await this.init();
    if (!this.idx[cookie.domain]) {
      this.idx[cookie.domain] = {};
    }
    if (!this.idx[cookie.domain][cookie.path]) {
      this.idx[cookie.domain][cookie.path] = {};
    }
    this.idx[cookie.domain][cookie.path][cookie.key] = cookie;
    saveToDB(this.idx, () => {
      cb(null);
    });
  }

  async updateCookie(oldCookie, newCookie, cb) {
    if (!this.initialized) await this.init();
    // updateCookie() may avoid updating cookies that are identical.  For example,
    // lastAccessed may not be important to some stores and an equality
    // comparison could exclude that field.
    this.putCookie(newCookie, cb);
  }

  async removeCookie(domain, path, key, cb) {
    if (!this.initialized) await this.init();
    if (this.idx[domain] && this.idx[domain][path] && this.idx[domain][path][key]) {
      delete this.idx[domain][path][key];
    }
    saveToDB(this.idx, () => {
      cb(null);
    });
  }

  async removeCookies(domain, path, cb) {
    if (!this.initialized) await this.init();
    if (this.idx[domain]) {
      if (path) {
        delete this.idx[domain][path];
      } else {
        delete this.idx[domain];
      }
    }
    saveToDB(this.idx, () => cb(null));
  }
}

module.exports = DynamoDBCookieStore;
DynamoDBCookieStore.prototype.idx = null;
DynamoDBCookieStore.prototype.synchronous = true;
