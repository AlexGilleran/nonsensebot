var co = require('co');
var pg = require('co-pg')(require('pg'));

String.prototype.surround = function(surroundWith) {
  return surroundWith + this + surroundWith;
};

var INSERT_MESSAGE_SQL = "INSERT INTO messages (\"from\", message, date, message_id, room_id) VALUES ($1, $2, $3, $4, $5);";
var INSERT_WORD_SQL = "INSERT INTO word(word, preceding_word, message_id) VALUES ($1, $2, $3);";
var GET_NEXT_WORDS_FROM_PAIR_SQL = "SELECT word2.word, count(word2.word) as \"count\" " +
  "FROM word AS \"word1\" " +
  "INNER JOIN word AS \"word2\" ON word2.preceding_word = word1.word AND word1.message_id = word2.message_id " +
  "WHERE word1.preceding_word = $1 AND word1.word = $2 " +
  "GROUP BY word2.word ORDER BY \"count\" DESC;";
var GET_NEXT_WORDS_FROM_SINGLE_SQL = "SELECT word, count(word) as \"count\" " +
  "FROM word " +
  "WHERE preceding_word = $1 " +
  "GROUP BY word ORDER BY \"count\" DESC;";
var GET_LEAST_COMMON_PREFIX = "SELECT word, COUNT(word) AS count FROM word WHERE ";
var GET_LEAST_COMMON_SUFFIX = "GROUP BY word ORDER BY count ASC;";

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

  this.getNextWords = function * (word1, word2) {
    var connResults = yield pg.connectPromise(process.env.DATABASE_URL);
    var client = connResults[0];
    var done = connResults[1];

    var result;
    if (word1) {
      result = yield client.queryPromise(GET_NEXT_WORDS_FROM_PAIR_SQL, [word1, word2]);
    } else {
      result = yield client.queryPromise(GET_NEXT_WORDS_FROM_SINGLE_SQL, [word2]);
    }

    done();

    if (!result.rows || !result.rows.length) {
      return null;
    } else {
      return result.rows;
    }
  };

  this.getStartingWords = function * (words) {
    var connResults = yield pg.connectPromise(process.env.DATABASE_URL);
    var client = connResults[0];
    var done = connResults[1];

    var sql = GET_LEAST_COMMON_PREFIX;
    for (var i = 1; i <= words.length; i++) {
      sql += "(word = $" + (i) + ") ";

      if (i < words.length) {
        sql += "OR ";
      }
    }
    sql += GET_LEAST_COMMON_SUFFIX;

    var result = yield client.queryPromise(sql, words);

    done();

    if (!result.rows || !result.rows.length) {
      return null;
    } else {
      return result.rows;
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