var route = require('koa-route');

function* index() {
  this.body = yield function(doneCb) {
    doneCb(null, "hello");
  };
}

module.exports = function(app) {
  app.use(route.get('/', index));
};