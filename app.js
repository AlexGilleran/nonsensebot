var logger = require('koa-logger');
var koa = require('koa');

var app = koa();

app.use(logger());

require('./routes/index')(app);
require('./routes/load')(app);

// app.on('error', function(err){
//   if (process.env.NODE_ENV != 'test') {
//     console.error(err);
//   }
// });

app.listen(process.env.PORT || 3000);

