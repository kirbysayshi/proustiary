var debug = require('debug')('reminder');
var hinterval = require('human-interval');
var conf = require('./conf');
var db = require('./db');
var scheduler = require('level-schedule')(db.register('reminder-scheduler'));
var unansweredDB = db('prompts-unanswered');

var REMINDER_JOB_NAME = 'reminder-prompt';

// Convert string durations into ms.
var key = 'reminderInterval';
var hr = conf.get(key);
var ms = hinterval(hr);
conf.set(key, ms);
debug('transforming', key, hr, ms);

exports.start = function() {
  scheduler.job(REMINDER_JOB_NAME, function() {
    console.log('reminding you to do stuff!');

    var self = this;
    unansweredDB.createReadStream()
      .on('data', function (data) {
        console.log(data.key, '=', data.value)
      })
      .on('error', function (err) {
        debug('error reading stream');
        self.run(REMINDER_JOB_NAME, Date.now() + conf.get(key))
      })
      .on('close', function () {
        debug('stream closed');
        self.run(REMINDER_JOB_NAME, Date.now() + conf.get(key))
      })
      .on('end', function () {
        debug('end of stream');
        self.run(REMINDER_JOB_NAME, Date.now() + conf.get(key))
      });
  }).run(REMINDER_JOB_NAME, Date.now() + conf.get(key));
}
