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
  var currentPair = yield db.getRandomWordPair();

  var messageSoFar = currentPair[0] + " " + currentPair[1];

  var currentValue = yield getForPair(currentPair);
  var count = 0;
  while (currentValue && count < 100) {
    messageSoFar += " " + currentValue;

    currentPair.shift();
    currentPair.push(currentValue);

    currentValue = yield getForPair(currentPair);
    count++;
  }

  if (messageSoFar) {
    this.body = messageSoFar;
  } else {
    throw new Error("Couldn't generate a messageSoFar.");
  }
}

function getRandomStart() {
  var index = Math.floor(Math.random() * keys.length);
  return keys[index];
}

function* getForPair(pair) {
  var possibleWords = yield db.getNextWords(pair[0], pair[1]);

  if (!possibleWords) {
    return null;
  }

  var resultArr = [];
  possibleWords.forEach(function(possibility) {
    for (var i = 0; i < possibility.count; i++) {
      resultArr.push(possibility.word);
    }
  });

  var randomIndex = Math.floor(Math.random() * resultArr.length);

  return resultArr[randomIndex];
}