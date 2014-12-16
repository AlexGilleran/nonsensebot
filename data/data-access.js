var pg = require('pg');

String.prototype.surround = function(surroundWith) {
  return surroundWith + this + surroundWith;
};

var INSERT_MESSAGE_SQL = "INSERT INTO messages (\"from\", message, date, id, room_id) VALUES ($1, $2, $3, $4, $5);";

var Data = function() {
  this.getMessages = function() {
    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      client.query('SELECT * FROM messages', function(err, result) {
        done();
        if (err) {
          console.error(err);
          response.send("Error " + err);
        } else {
          response.send(result.rows);
        }
      });
    });
  };

  this.getLatestMessage = function(roomId, successCb, errCb) {
    connect(errCb, function(err, client, done) {
      var query = client.query('SELECT * FROM messages WHERE room_id = $1 ORDER BY date DESC LIMIT 1', [roomId], queryHandler(errCb, done, function(result) {
        if (result.rows.length === 0) {
          successCb(null);
        } else {
          successCb(mapToMessages(result)[0]);
        }
      }));
    });
  };

  this.insertMessages = function(messages, successCb, errCb) {
    connect(errCb, function(err, client, done) {
      var completedInserts = 0;
      var rollBackErr = null;

      client.query("BEGIN", onTransactionBegun);

      function onTransactionBegun(err, result) {
        if (err) {
          errCb(err);
        }

        messages.forEach(function(message) {
          if (rollBackErr) {
            return false;
          }

          // [message.from.id, message.message.replace("'", "''").surround("'"), message.date.surround("'"), message.id.surround("'"), message.roomId].join(", ") + ");");

          client.query(INSERT_MESSAGE_SQL, [message.from.id, message.message, message.date, message.id, message.roomId], onInsertFinished);
        });
      }

      function onInsertFinished(err, result) {
        if (err) {
          rollBackErr = err;
          client.query("ROLLBACK", onTransactionFinished);
          return;
        }

        completedInserts += 1;

        if (completedInserts === messages.length) {
          client.query("COMMIT", onTransactionFinished);          
        }
      }

      function onTransactionFinished(err, result) {
        if (err || rollBackErr) {
          errCb(err + rollBackErr);
          return;
        }

        successCb();
      }
    });
  };

  function connect(errCb, successCb) {
    pg.connect(process.env.DATABASE_URL, function(err, client, done) {
      if (err) {
        errCb(err);
      } else {
        successCb(err, client, done);
      }
    });
  }

  function queryHandler(errCb, done, resultCb) {
    return function(err, result) {
      done();

      if (err) {
        errCb(err);
      } else {
        resultCb(result);
      }
    };
  }

  function mapToMessages(result) {
    var messages = [];

    result.rows.forEach(function(row) {
      messages.push({
        from: {
          id: row.id
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