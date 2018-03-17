const Promise = require('bluebird');
const fs = require('fs');

class DataMarshal {
  constructor() {
    this._records = [];
  };

  addRecord({instagramId, lastInteractionAt, latestMediaId, latestMediaUrl, latestMediaCreatedAt, username, isFollowing, isFollower, isActive} = {}) {
    this._records.push({
      lastInteractionAt: lastInteractionAt || 0,
      instagramId: instagramId.toString(),
      latestMediaId,
      latestMediaUrl,
      latestMediaCreatedAt: latestMediaCreatedAt || 0,
      username,
      isFollowing,
      isFollower,
      isActive,
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
        isFollowing,
        isFollower,
        isActive,
      } = record;

      this.addRecord({
        instagramId,
        lastInteractionAt,
        latestMediaId,
        latestMediaUrl,
        latestMediaCreatedAt,
        username,
        isFollowing,
        isFollower,
        isActive,
      });
    });
  }
};

exports.service = {
  DataMarshal,
}
