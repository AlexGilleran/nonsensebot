var Client = require('node-rest-client').Client;

var client = new Client();

client.registerMethod("getHistory", "https://api.hipchat.com/v2/room/${roomId}/history", "GET");

var Hipchat = function() {
  this.getHistoryForRoom = function(roomId, date, successCb, failureCb, startIndex, size) {
    startIndex = startIndex || 0;

    client.methods.getHistory(buildArgs(roomId, date, startIndex, size), onMessagesResponse(successCb, roomId)).on("error", failureCb);
  };

  function onMessagesResponse(successCb, roomId) {
    return function(data, response) {
      data.items.forEach(function(item) {
        item.roomId = roomId;
      });

      successCb({
        messages: data.items,
        startIndex: data.startIndex,
        more: !!data.links.next
      });
    };
  };

  function buildArgs(roomId, date, startIndex, size) {
    return {
      path: {
        roomId: roomId
      },
      parameters: {
        "auth_token": process.env.AUTH_TOKEN,
        "date": date,
        "start-index": startIndex,
        "max-results": size
      }
    };
  };
};

module.exports = Hipchat;