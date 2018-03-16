const Promise = require('bluebird');

class DataMarshal {
  constructor() {
    this._records = [];
  };

  addRecord({instagramOwner, instagramId, lastInteractionAt, latestMediaId, latestMediaUrl, latestMediaCreatedAt, username} = {}) {
    this._records.push({
      lastInteractionAt: lastInteractionAt || 0,
      instagramOwner,
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
        instagramOwner,
        instagramId,
        lastInteractionAt,
        latestMediaId,
        latestMediaUrl,
        latestMediaCreatedAt,
        username,
      } = record;

      this.addRecord({
        instagramOwner,
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
