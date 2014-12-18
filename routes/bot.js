var Data = require("../data/data-access");
var Hipchat = require("../hipchat/hipchat-api");
var _ = require("lodash");
var route = require('koa-route');

var db = new Data();

var messageCache;
var keys;

module.exports = function(app) {
  app.use(route.get('/bot/randomMessage', randomMessage));
};

function * randomMessage() {
  if (!messageCache) {
    yield buildMessageCache();
  }

  var currentPair = getRandomStart();
  var message = currentPair;
  var currentValue = getForPair(currentPair);
  while (currentValue) {
    message += " " + currentValue;

    var messageArr = message.split(" ");
    var lastIndex = messageArr.length - 1;
    currentPair = messageArr[lastIndex - 1] + " " + messageArr[lastIndex];

    currentValue = getForPair(currentPair);
  }

  if (message) {
    this.body = message;
  } else {
    throw new Error("Couldn't generate a message.");
  }
}

function * buildMessageCache() {
  var messages = yield db.getAllMessages();

  messageCache = {};

  messages.forEach(function(message) {
    if (!message.message) {
      return true;
    }

    var words = message.message.split(" ");

    if (words.length < 3) {
      return true;
    }

    for (var i = 0; i < words.length - 2; i++) {
      var pair = words[i] + " " + words[i + 1];
      var word = words[i + 2];

      if (!messageCache[pair]) {
        messageCache[pair] = {};
      }

      if (!messageCache[pair][word]) {
        messageCache[pair][word] = 0;
      }

      messageCache[pair][word] += 1;
    }
  });

  keys = Object.keys(messageCache);
}

function getRandomStart() {
  var index = Math.floor(Math.random() * keys.length);
  return keys[index];
}

function getForPair(pair) {
  var resultArr = [];

  _.pairs(messageCache[pair]).forEach(function(pairArray) {
    for (var i = 0; i < pairArray[1]; i++) {
      resultArr.push(pairArray[0]);
    }
  });

  var randomIndex = Math.floor(Math.random() * resultArr.length);

  return resultArr[randomIndex];
}