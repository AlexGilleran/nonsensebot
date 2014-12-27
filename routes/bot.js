/*jshint loopfunc: true */

var Data = require("../data/data-access");
var Hipchat = require("../hipchat/hipchat-api");
var _ = require("lodash");
var route = require('koa-route');
var co = require("co");
var jsonBody = require("koa-parse-json");

var MAX_LENGTH = 30;

var db = new Data();
var hipchat = new Hipchat();

var forwardTable;
var keys;
var excludeWords = ["a", "able", "about", "across", "after", "all", "almost", "also", "am", "among", "an", "and", "any", "are", "as", "at", "be", "because", "been", "but", "by", "can", "cannot", "could", "dear", "did", "do", "does", "either", "else", "ever", "every", "for", "from", "get", "got", "had", "has", "have", "he", "her", "hers", "him", "his", "how", "however", "i", "if", "in", "into", "is", "it", "its", "just", "least", "let", "like", "likely", "may", "me", "might", "most", "must", "my", "neither", "no", "nor", "not", "of", "off", "often", "on", "only", "or", "other", "our", "own", "rather", "said", "say", "says", "she", "should", "since", "so", "some", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "tis", "to", "too", "twas", "us", "wants", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "will", "with", "would", "yet", "you", "your", "ain't", "aren't", "can't", "could've", "couldn't", "didn't", "doesn't", "don't", "hasn't", "he'd", "he'll", "he's", "how'd", "how'll", "how's", "i'd", "i'll", "i'm", "i've", "isn't", "it's", "might've", "mightn't", "must've", "mustn't", "shan't", "she'd", "she'll", "she's", "should've", "shouldn't", "that'll", "that's", "there's", "they'd", "they'll", "they're", "they've", "wasn't", "we'd", "we'll", "we're", "weren't", "what'd", "what's", "when'd", "when'll", "when's", "where'd", "where'll", "where's", "who'd", "who'll", "who's", "why'd", "why'll", "why's", "won't", "would've", "wouldn't", "you'd", "you'll", "you're", "you've", "really"];
var excludeLookup = _.indexBy(excludeWords, function(word) {
  return word;
});

module.exports = function (app) {
  app.use(jsonBody());
  app.use(route.get('/bot/generateMessage', generateMessage));
  app.use(route.post('/bot/hook', hookPost));
};

function * generateMessage() {
  var message = this.request.query.message;
  var reply = yield getMessage(message);

  this.body = reply;
}

function * hookPost() {
  var body = this.request.body;
  var message = body.item.message;

  if (!(message.from === process.env.BOT_USER_ID && message.type === "notification")) {
    var reply = yield getMessage(message.message);

    yield hipchat.postMessage("BOT: " + reply);

    this.body = reply;
  } else {
    this.body = "This bot isn't going to talk to itself!";
  }
}

function * getMessage(message) {
  if (!message) {
    throw new Error("Attempted to get a response for a message but message was falsy");
  }

  var words = message.split(" ");
  words = _.shuffle(words);

  var tables = yield buildMessageTables(words);

  if (!tables) {
    return "No idea.";
  }

  words = _.filter(words, function(word) {
    if (excludeLookup[word]) {
      return false;
    }
    return true;
  });
  var targetWordLookup = _.indexBy(words, function(word) {
    return word;
  });

  var potentialStarts = _.shuffle(Object.keys(tables.forward));

  var startWords = _.find(potentialStarts, function(start) {
    for (var i = 0; i < words.length; i++) {
      if (start.indexOf(words[i]) >= 0) {
        return true;
      }
    }
  });

  if (!startWords) {
    startWords = potentialStarts[_.random(0, potentialStarts.length - 1)];
  }

  if (!startWords) {
    this.body = "Say what?";
    return;
  }

  var messageArr, lastIndex;
  var currentPair = startWords;
  var messageSoFar = currentPair;
  var currentValue = getForPair(currentPair, tables.forward, targetWordLookup);
  while (currentValue && messageSoFar.length < 500) {
    messageSoFar += " " + currentValue;
    messageArr = messageSoFar.split(" ");
    lastIndex = messageArr.length - 1;
    currentPair = messageArr[lastIndex - 1] + " " + messageArr[lastIndex];
    currentValue = getForPair(currentPair, tables.forward, targetWordLookup);
  }
  
  currentPair = startWords;
  currentValue = getForPair(currentPair, tables.back, targetWordLookup);
  while (currentValue && messageSoFar.length < 500) {
    messageSoFar = currentValue + " " + messageSoFar;
    messageArr = messageSoFar.split(" ");
    currentPair = messageArr[0] + " " + messageArr[1];
    currentValue = getForPair(currentPair, tables.back, targetWordLookup);
  }

  if (messageSoFar) {
    return messageSoFar;
  } else {
    throw new Error("Couldn't generate a messageSoFar.");
  }
}

function getForPair(pair, messageTable, targetWords) {
  var resultArr = [];
  _.pairs(messageTable[pair]).forEach(function (pairArray) {
    for (var i = 0; i < pairArray[1]; i++) {
      var word = pairArray[0];

      if (targetWords[word]) {
        return word;
      } else {
        resultArr.push(pairArray[0]);
      }

    }
  });
  return resultArr[_.random(0, resultArr.length - 1)];
}

function * buildMessageTables(startWords) {
  var messages = yield db.getMessagesWithWords(startWords);

  if (!messages) {
    return null; 
  }

  forwardTable = {};
  backwardTable = {};

  messages.forEach(function (message) {
    if (!message.message) {
      return true;
    }

    var words = message.message.split(" ");

    if (words.length < 3) {
      return true;
    }

    var pair, word, i;
    for (i = 0; i < words.length - 2; i++) {
      pair = words[i] + " " + words[i + 1];
      word = words[i + 2];

      if (!forwardTable[pair]) {
        forwardTable[pair] = {};
      }

      if (!forwardTable[pair][word]) {
        forwardTable[pair][word] = 0;
      }

      forwardTable[pair][word] += 1;
    }

    for (i = 1; i < words.length - 1; i++) {
      pair = words[i] + " " + words[i + 1];
      word = words[i - 1];

      if (!backwardTable[pair]) {
        backwardTable[pair] = {};
      }

      if (!backwardTable[pair][word]) {
        backwardTable[pair][word] = 0;
      }

      backwardTable[pair][word] += 1;
    }
  });

  return {
    back: backwardTable,
    forward: forwardTable
  };
}