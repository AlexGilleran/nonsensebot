var URI = require('URIjs');
var URITemplate = require('URIjs/src/URITemplate');
var request = require('request');

var Hipchat = function () {
  var historyTemplate = new URITemplate("https://api.hipchat.com/v2/room/{roomId}/history{?q*}");
  var notificationTemplate = new URITemplate("https://api.hipchat.com/v2/room/{roomId}/notification{?q*}");

  this.getHistoryForRoom = function * (roomId, date, startIndex, size) {
    return yield new Promise(function (resolve, reject) {
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

      request(uri, function (error, response, body) {
        if (error) {
          reject(error);
        }

        body = JSON.parse(body);

        if (body.items && body.items.length) {
          body.items.forEach(function (item) {
            item.roomId = roomId;
          });
        }

        resolve(body);
      });
    });
  };

  this.postMessage = function * (message) {
    return yield new Promise(function (resolve, reject) {
      var uri = notificationTemplate.expand({
        roomId: process.env.ROOM_ID,
        q: {
          "auth_token": process.env.AUTH_TOKEN,
        }
      });
      request.post({
          url: uri,
          form: {
            message: message,
            message_format: "text"
          }
        },
        function (error, response) {
          if (error || response.statusCode !== 204) {
            reject(error + " " + response.body);
          } else {
            resolve(response);
          }
        }
      );
    });
  };
};

module.exports = Hipchat;