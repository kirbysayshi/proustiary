var debug = require('debug')('reminder');
var hinterval = require('human-interval');
var conf = require('./conf');
var db = require('./db');
var unansweredDB = db('prompts-unanswered');

// Convert string durations into ms.
['timeBetweenReminders', 'reminderJobInterval']
.forEach(function(key) {
  var hr = conf.get(key);
  var ms = hinterval(conf.get(key));
  conf.set(key, ms);
  debug('transforming', key, hr, ms);
});

var prompt = function() {
  var prompts = conf.get('reminderPrompts');
  return prompts[Math.floor(Math.random() * prompts.length)];
};

var scan = function(reminderHook, done) {
  unansweredDB.createReadStream()
    .on('data', function(data) {
      var nextReminder = new Date(data.value.lastReminder + conf.get('timeBetweenReminders'));
      if (nextReminder < Date.now()) {
        reminderHook({
          hash: data.key.substring('unanswered!'.length),
          prompt: prompt(),
          unansweredPrompt: data.value
        });
      }
    })
    .on('error', function(err) {
      debug('scanning unanswered failed', err);
      if (done) return done(err);
    })
    .on('close', function() {
      if (done) return done();
    });
};

// We don't really need the reminder job to be persistent. Reminders are sent
// only as a function of unanswered prompts. Pass a hook to be called for each
// user that needs a reminder.
//
// reminderHook is passed a payload containing the user hash and reminder prompt
var interval;
exports.start = function(reminderHook, done) {
  if (!reminderHook) throw new Error('reminderHook is undefined');
  interval = setInterval(scan, conf.get('reminderJobInterval'), reminderHook, done);
};

exports.stop = function() {
  if (interval) clearInterval(interval);
};
