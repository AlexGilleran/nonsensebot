var Data = require("../data/data-access");
var Hipchat = require("../hipchat/hipchat-api");
var _ = require("lodash");
var route = require('koa-route');

var db = new Data();
var hipchat = new Hipchat();

var PAGE_SIZE = 1000;

module.exports = function(app) {
  app.use(route.get('/load/latestMessage', latestMessage));
  app.use(route.get('/load/fetch', fetch));
  app.use(route.get('/load/index', index));
};

function * latestMessage() {
  var message = yield db.getLatestMessage(this.request.query.roomId);

  if (message) {
    this.body = message;
  } else {
    throw new Error("no latest message for the supplied room.");
  }
}

function * fetch() {
  var hasNext = true;
  var offset = 0;
  var counter = 0;

  while (hasNext) {
    var history = yield hipchat.getHistoryForRoom(this.request.query.roomId, new Date().toISOString(), offset, PAGE_SIZE);
    offset += PAGE_SIZE;

    if (history.items) {
      yield db.insertMessages(history.items);
      counter += history.items.length;
    }

    hasNext = history.items.length === PAGE_SIZE;
    console.log("inserted " + counter + " items");

    yield setTimeoutThunk(5000);
  }

  this.body = "inserted " + counter + " items";
}

function * index() {
  var offset = 0;

  var totalMessages = yield db.countMessages();

  var indexingFuncs = [];
  while (offset < totalMessages) {
    indexingFuncs.push(indexChunk(offset));

    offset += PAGE_SIZE;
  }

  yield indexingFuncs;

  this.body = "indexed " + totalMessages + " messages";
}

function indexChunk (offset) {
  return function * () {
    var messages = yield db.getMessages(offset, PAGE_SIZE);

    var insertFuncs = [];
    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];

      if (message.message) {
        // console.log(JSON.stringify(getWordPairs(message.message)) + " " + message.id);
        insertFuncs.push(insertChunk(getWordPairs(message.message), message.id));
      }
    }

    yield insertFuncs;
  };
}

function insertChunk(wordPairs, messageId) {
  return function * () {
    yield db.insertWordPairs(wordPairs, messageId);
  };
}

function getWordPairs(messageText) {
  var pairs = [];
  var words = messageText.split(" ");

  if (words.length < 2) {
    return [];
  }

  for (var i = 0; i < words.length - 1; i++) {
    pairs.push([words[i], words[i + 1]]);
  }

  return pairs;
}

function setTimeoutThunk(ms) {
  return function(cb) {
    setTimeout(cb, ms);
  };
}