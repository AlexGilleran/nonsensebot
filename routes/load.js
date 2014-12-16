
var express = require('express');
var router = express.Router();
var Data = require("../data/data-access");
var Hipchat = require("../hipchat/hipchat-api");
var _ = require("lodash");

var db = new Data();
var hipchat = new Hipchat();

var PAGE_SIZE = 1000;

router.get('/latestMessage', function(request, response) {
  db.getLatestMessage(roomId, function(message) {
    response.send(message);
  }, onError.bind(this, response));
});

router.get('/put', function(request, response) {
  db.insertMessages([message1, message2], function() {
    response.send("Inserted!");
  }, onError.bind(this, response));
});

router.get('/before/:date', function(request, response) {
  var date = request.param("date") || new Date().toISOString();
  var roomId = request.query.roomId;
  var insertCount = 0;
  var finished = false;

  if (!roomId) {
    response.send("SET A ROOM ID!!!");
    return;
  }

  db.getLatestMessage(roomId, afterLatest, onFailure);

  function afterLatest(message) {
    var latestMessageId = message ? message.id : null;

    hipchat.getHistoryForRoom(roomId, date, onHipchatSuccess(latestMessageId), onFailure, 0, PAGE_SIZE);
  }

  function onHipchatSuccess(latestMessageId) {
    return function(data) {
      console.log("Retrieved " + data.messages.length + " messages successfully.");
      var latestMessageIndex = -1;

      if (latestMessageId) {
        latestMessageIndex = _.findLastIndex(data.messages, function(message) {
          return message.id === latestMessageId;
        });
      }

      if (data.more && latestMessageIndex === -1) {
        hipchat.getHistoryForRoom(roomId, date, onHipchatSuccess, onFailure, data.startIndex + data.messages.count, PAGE_SIZE);
      } else {
        if (latestMessageIndex !== -1) {
          data.messages = data.messages.slice(latestMessageIndex);
        }

        finished = true;
      }

      db.insertMessages(data.messages, onDbInsertSuccess, onFailure);
    };
  }

  function onDbInsertSuccess(messages) {
    return function() {
      insertCount += messages.length;
      console.log("Inserted " + insertCount + " rows successfully so far.");

      if (finished) {
        response.send("Inserted " + insertCount + " rows");
      }
    };
  }

  function onFailure(err) {
    console.error(err);
    response.send("Inserted " + insertCount + " rows." + err);
  }
});

function onError(response, err) {
  console.error(err);
  response.send(err);
}

module.exports = router;