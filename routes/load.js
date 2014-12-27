var Data = require("../data/data-access");
var Hipchat = require("../hipchat/hipchat-api");
var _ = require("lodash");
var route = require('koa-route');

var db = new Data();
var hipchat = new Hipchat();

var PAGE_SIZE = 1000;

module.exports = function(app) {
  app.use(route.get('/load/fetch', fetch));
};

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

function setTimeoutThunk(ms) {
  return function(cb) {
    setTimeout(cb, ms);
  };
}