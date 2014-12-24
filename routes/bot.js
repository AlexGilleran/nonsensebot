/*jshint loopfunc: true */

var Data = require("../data/data-access");
var Hipchat = require("../hipchat/hipchat-api");
var _ = require("lodash");
var route = require('koa-route');
var co = require("co");

var MAX_LENGTH = 30;

var db = new Data();

var messageCache;
var keys;

module.exports = function(app) {
  app.use(route.get('/bot/randomMessage', randomMessage));
};

function * randomMessage() {
  console.log("===");
  if (!this.request.query.message) {
    throw new Error("pass a message in the query string");
  }

  var startWords = yield getStart(this.request.query.message);

  if (!startWords) {
    this.body = "Say what?";
    return;
  }

  var startWord = startWords[0].word;
  var funcs = [

    function * () {
      return yield getMarkov(startWord);
    }
  ];

  console.log(startWords);

  if (startWords.length > 1) {
    var seekingWord = startWords[1].word;
    funcs.push(function * () {
      var result = yield getWithPathFinding(startWord, seekingWord, {});
      if (result) {
        return result.join(" ");
      }
    });
  }

  var results = yield funcs;

  console.log(results);

  var message;

  if (results.length > 1 && results[1]) {
    message = results[1];
  } else {
    message = results[0];
  }

  if (message) {
    this.body = message;
  } else {
    throw new Error("Couldn't generate a messageSoFar.");
  }
}

function * getStart(message) {
  var words = message.split(" ");

  return yield db.getStartingWords(words);
}

function getRandomStart() {
  var index = Math.floor(Math.random() * keys.length);
  return keys[index];
}

var count = 0;

function * getWithPathFinding(startWord, seekingWord, cache) {
  if (!cache[startWord]) {
    cache[startWord] = co(function * () {
      if (startWord === seekingWord) {
        return [seekingWord];
      }

      var possibilities = yield db.getNextWords(undefined, startWord);
      if (!possibilities || !possibilities.length) {
        return;
      }

      console.log(possibilities);

      var funcs = [];
      for (var i = 0; i < possibilities.length; i++) {
        var possibility = possibilities[i].word;

        funcs.push(co(function * () {
          return yield getWithPathFinding(possibility, seekingWord, cache);
        }));
      }

      var results = yield funcs;
      results.forEach(function(thisResult) {
        if (thisResult && thisResult.length && thisResult[0]) {
          result = thisResult;
        }
      });

      if (result) {
        return [startWord].concat(result);
      }

      return null;
    });
  } else {
    cache[startWord].then(function() {
      console.log("YAAARGGH");
    });
    //FIXME: For some reason we can't yield to a fulfilled promise.
    return;
  }


  var result = yield cache[startWord];

  if (result && result.length < MAX_LENGTH) {
    return result;
  }

  return null;
}

function * getMarkov(startWord) {
  console.log("markoving " + startWord);
  var messageSoFar = startWord;
  var currentPair = [undefined, startWord];
  var currentValue = yield getForPair(currentPair);
  var count = 0;
  while (currentValue && count < MAX_LENGTH) {
    messageSoFar += " " + currentValue;

    currentPair.shift();
    currentPair.push(currentValue);

    currentValue = yield getForPair(currentPair);
    count++;
  }

  return messageSoFar;
}

function * getForPair(pair) {
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