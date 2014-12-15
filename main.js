var https = require("https");
var _ = require("lodash");
var Client = require('node-rest-client').Client;

var client = new Client();

var buildArgs = function(roomId, date, startIndex) {
  return {
    path: {
      roomId: roomId
    },
    parameters: {
      "auth_token": process.env.AUTH_TOKEN,
      "date": date,
      "start-index": startIndex,
      "max-results": 1000
    }
  };
};

client.registerMethod("getHistory", "https://api.hipchat.com/v2/room/${roomId}/history", "GET");

var printDayHistory = function(roomId, date, startIndex) {
  startIndex = startIndex || 0;

  client.methods.getHistory(buildArgs(roomId, date, startIndex), function(data, response) {
    if (data.links.next) {
      console.log("has next");
      // printDayHistory(roomId, date, startIndex + 100);
    }

    data.items.forEach(function(item) {
      console.log("[" + item.date + "] " + item.from.name + ": " + item.message);
    });
  });
};

printDayHistory(955532, "20141211");