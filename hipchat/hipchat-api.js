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

    var res = yield * request(uri, true);

    console.log(res.body);

    return res.body;
  };

  function onMessagesResponse(successCb, roomId) {
    return function(data, response) {
      data.items.forEach(function(item) {
        item.roomId = roomId;
      });

      successCb({
        messages: data.items,
        startIndex: data.startIndex,
        more: !! data.links.next
      });
    };
  }
};

module.exports = Hipchat;