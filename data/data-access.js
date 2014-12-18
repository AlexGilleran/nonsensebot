var co = require('co');
var pg = require('co-pg')(require('pg'));

String.prototype.surround = function(surroundWith) {
  return surroundWith + this + surroundWith;
};

var INSERT_MESSAGE_SQL = "INSERT INTO messages (\"from\", message, date, message_id, room_id) VALUES ($1, $2, $3, $4, $5);";
var INSERT_WORD_SQL = "INSERT INTO word(word, preceding_word, message_id) VALUES ($1, $2, $3);";

var Data = function() {
  this.getLatestMessage = function * (roomId) {
    var connResults = yield pg.connectPromise(process.env.DATABASE_URL);
    var client = connResults[0];
    var done = connResults[1];

    var result = yield client.queryPromise("SELECT * FROM messages WHERE room_id = $1 ORDER BY date DESC LIMIT 1", [roomId]);

    done();

    if (!result.rows || result.rows.length === 0) {
      return null;
    } else {
      return mapToMessages(result)[0];
    }
  };

  this.countMessages = function* () {
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

  this.insertWordPairs = function * (wordPairs, messageId) {
    var connResults = yield pg.connectPromise(process.env.DATABASE_URL);
    var client = connResults[0];
    var done = connResults[1];

    yield client.queryPromise("BEGIN");
    try {
      for (var i = 0; i < wordPairs.length; i++) {
        var wordPair = wordPairs[i];

        yield client.queryPromise(INSERT_WORD_SQL, [wordPair[1], wordPair[0], messageId]);
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