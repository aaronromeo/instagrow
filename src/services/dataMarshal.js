const Promise = require('bluebird');
const fs = require('fs');

class DataMarshal {
  constructor() {
    this._records = [];
  };

  addRecord({instagramId, lastInteractionAt, latestMediaId, latestMediaUrl, latestMediaCreatedAt, username} = {}) {
    this._records.push({
      lastInteractionAt: lastInteractionAt || 0,
      instagramId: instagramId.toString(),
      latestMediaId,
      latestMediaUrl,
      latestMediaCreatedAt: latestMediaCreatedAt || 0,
      username,
    })
  }

  get records() { return this._records };

  exportData(filename) {
    fs.writeFileSync(filename, JSON.stringify(this._records), 'utf8');
    return new Promise.resolve();;
  }

  importData(filename) {
    JSON.parse(fs.readFileSync(filename, 'utf8')).forEach(record => {
      const {
        instagramId,
        lastInteractionAt,
        latestMediaId,
        latestMediaUrl,
        latestMediaCreatedAt,
        username,
      } = record;

      this.addRecord({
        instagramId,
        lastInteractionAt,
        latestMediaId,
        latestMediaUrl,
        latestMediaCreatedAt,
        username,
      });
    });
  }
};

exports.service = {
  DataMarshal,
}
