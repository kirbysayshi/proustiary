var path = require('path');
var test = require('tape');
var rimraf = require('rimraf');

var conf = require('../lib/conf');

// Inject a test db path for modules that require('./db')
var testDB = path.join(__dirname, './db');
conf.set('dbPath', testDB);
conf.set('timeBetweenReminders', '1 second');
conf.set('reminderJobInterval', '1 second');

resetDB();

var prompt = require('../lib/prompt');

var db = require('../lib/db');
var Reminder = require('../lib/reminder');
var promptsUnansweredDB = db('prompts-unanswered');
var promptsAnsweredDB = db('prompts-answered');
var promptsMetadataDB = db('prompts-metadata');

test('unanswered prompt needs a reminder', function(t) {
  var twoSecondsAgo = Date.now() - (2 * 1000);
  var p = {
    prompted: twoSecondsAgo,
    lastReminder: twoSecondsAgo,
    answered: null,
    promptId: 0,
    question: 'a',
    answer: null
  }

  prompt.saveUnanswered('user1', p, function(err) {
    t.ifErr(err);
    Reminder.start(function(payload) {
      t.equal(payload.hash, 'user1', 'hash is set');
      t.ok(payload.prompt, 'prompt is set');
      t.looseEqual(payload.unansweredPrompt, p, 'unanswerPrompt is set');
      Reminder.stop();
      t.end();
    });
  });
});

test('unanswered prompt does not need a reminder', function(t) {
  var futureTime = Date.now() + (60 * 60 * 1000);
  var p = {
    prompted: futureTime,
    lastReminder: futureTime,
    answered: null,
    promptId: 0,
    question: 'a',
    answer: null
  }

  prompt.saveUnanswered('user1', p, function(err) {
    t.ifErr(err);
    Reminder.start(
      function() {
        t.fail('reminderHook should not be called')
      },
      function(err) {
        t.false(err, 'err is not set');
        Reminder.stop();
        t.end();
      }
    );
  });
});

test('cleanup', function(t) {
  resetDB();
  t.end();
})

function resetDB() {
  // Kill any existing test DB
  rimraf.sync(testDB);
  require('fs').mkdirSync(testDB);
}
