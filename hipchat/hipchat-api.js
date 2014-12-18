var URI = require('URIjs');
var URITemplate = require('URIjs/src/URITemplate');
var request = require('cogent');

var Hipchat = function() {
  var historyTemplate = new URITemplate("https://api.hipchat.com/v2/room/{roomId}/history{?q*}");

  this.getHistoryForRoom = function * (roomId, date, startIndex, size) {
    startIndex = startIndex || 0;
    var uri = historyTemplate.expand({
      roomId: roomId,
      q: {
        "auth_token": process.env.AUTH_TOKEN,
        "date": date,
        "start-index": startIndex,
        "max-results": size
      }
    });

    var res = yield * request(uri, {
      json: true
    });

    res.body.items.forEach(function(item) {
      item.roomId = roomId;
    });

    return res.body;
  };
};

module.exports = Hipchat;