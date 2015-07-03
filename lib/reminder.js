var debug = require('debug')('reminder');
var hinterval = require('human-interval');
var conf = require('./conf');
var db = require('./db');
var unansweredDB = db('prompts-unanswered');
var User = require('./user');

// JF: should we really depend on twilio here?
var twilio = require('./twilio')(conf.get('twilioSID'), conf.get('twilioTOKEN'));

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

var remind = function(data) {
  var key = data.key;
  var hash = key.substring('unanswered!'.length);

  User.getFromHash(hash, function(err, userInfo) {
    debug('reminding user', userInfo);
    twilio.sendMessage({
      to: userInfo.number,
      from: conf.get('twilioNumber'),
      body: prompt()
    }, function(err, res) {
      if (err) {
        return debug('failed to remind user', err);
      }
      data.value.reminded = Date.now();
      unansweredDB.put(data.key, data.value, function() {
        debug('updated unanswered', arguments)
      });
    });
  });
};

var scan = function(fn) {
  unansweredDB.createReadStream()
    .on('data', function(data) {
      var lastReminder = data.value.reminded || data.value.prompted;
      if (new Date(lastReminder + conf.get('timeBetweenReminders')) < Date.now()) {
        remind(data);
      }
    })
    .on('error', function(err) {
      debug('scanning unanswered failed', err);
    });
};

// We don't really need the reminder job to be persistent. Reminders are sent
// only as a function of unanswered prompts.
exports.start = function() {
  setInterval(scan, conf.get('reminderJobInterval'));
};
