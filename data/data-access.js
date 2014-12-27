var co = require('co');
var pg = require('co-pg')(require('pg'));
var _ = require('lodash');

var INSERT_MESSAGE_SQL = "INSERT INTO messages (\"from\", message, date, message_id, room_id) VALUES ($1, $2, $3, $4, $5);";
var SELECT_MESSAGES_PREFIX_SQL = "SELECT message FROM messages WHERE ";

var Data = function() {

  this.countMessages = function * () {
    var connResults = yield pg.connectPromise(process.env.DATABASE_URL);
    var client = connResults[0];
    var done = connResults[1];

    var result = yield client.queryPromise("SELECT count(message_id) as \"count\" FROM messages;");

    done();

    return parseInt(result.rows[0].count);
  };

  this.getMessages = function * (offset, size) {
    var connResults = yield pg.connectPromise(process.env.DATABASE_URL);
    var client = connResults[0];
    var done = connResults[1];

    var result = yield client.queryPromise("SELECT * FROM messages OFFSET $1 LIMIT $2;", [offset, size]);

    done();

    if (!result.rows || result.rows.length === 0) {
      return null;
    } else {
      return mapToMessages(result);
    }
  };

  this.getMessagesWithWords = function * (words) {
    var connResults = yield pg.connectPromise(process.env.DATABASE_URL);
    var client = connResults[0];
    var done = connResults[1];
    var sql = SELECT_MESSAGES_PREFIX_SQL;

    words = _.map(words, function(word) {
      return "%" + word + "%";
    });

    for (var i = 1; i <= words.length; i++) {
      sql += "message LIKE $" + i;

      if (i < words.length) {
        sql += " OR ";
      }
    }

    sql += ";";

    var result = yield client.queryPromise(sql, words);

    done();

    if (!result.rows || result.rows.length === 0) {
      return null;
    } else {
      return mapToMessages(result);
    }
  };

  this.insertMessages = function * (messages) {
    var connResults = yield pg.connectPromise(process.env.DATABASE_URL);
    var client = connResults[0];
    var done = connResults[1];

    yield client.queryPromise("BEGIN");
    try {
      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        yield client.queryPromise(INSERT_MESSAGE_SQL, [message.from.id, message.message, message.date, message.id, message.roomId]);
      }
      yield client.queryPromise("END");
    } catch (e) {
      yield client.queryPromise("ROLLBACK");
      throw e;
    }

    done();
  };

  function mapToMessages(result) {
    var messages = [];

    result.rows.forEach(function(row) {
      messages.push({
        id: row.message_id,
        from: {
          id: row.from
        },
        message: row.message,
        date: row.date,
        roomId: row.room_id
      });
    });

    return messages;
  }
};

module.exports = Data;