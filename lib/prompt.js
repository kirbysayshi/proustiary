var debug = require('debug')('prompt');
var hdate = require('human-date');
var hinterval = require('human-interval');
var db = require('./db');
var promptsUnansweredDB = db.register('prompts-unanswered');
var promptsAnsweredDB = db.register('prompts-answered');
var scheduler = require('level-schedule')(db.register('prompt-scheduler'));

var Prompts = require('./prompts');
var User = require('./user');
var conf = require('./conf');

var PROMPT_JOB_NAME = 'send-prompt';

// Convert string durations into ms.
['minTimeBetweenPrompts', 'maxTimeBetweenPrompts']
.forEach(function(key) {
  var hr = conf.get(key);
  var ms = hinterval(conf.get(key));
  conf.set(key, ms);
  debug('transforming', key, hr, ms);
});

exports.setJobHook = function(cb) {
  scheduler.job(PROMPT_JOB_NAME, cb);
}

exports.schedule = function(userHash, cb) {
  Prompts.next(userHash, function(err, nextPrompt) {
    if (err) return cb(err);

    var prompt = {
      prompted: null,
      answered: null,
      promptId: nextPrompt.id,
      question: nextPrompt.question,
      answer: null
    }

    var max = conf.get('maxTimeBetweenPrompts');
    var min = conf.get('minTimeBetweenPrompts');

    var arriveIn = Math.random() * max - min;

    var arriveAt = Date.now() + arriveIn;

    debug(
      'scheduled ' + hdate.relativeTime(arriveIn/1000),
      'now:' + Date.now(),
      'arriveIn:' + arriveIn,
      'arriveAt:' + arriveAt,
      userHash,
      prompt);

    scheduler.run(PROMPT_JOB_NAME, {
      hash: userHash,
      prompt: prompt
    }, arriveAt);

    cb(null);
  });
}

exports.saveUnanswered = function(userHash, prompt, cb) {
  prompt.prompted = Date.now();
  var ukey = 'unanswered!' + userHash;
  promptsUnansweredDB.put(ukey, prompt, function(err) {
    if (err) return cb(err);
    return cb(null);
  });
}

exports.answer = function(userHash, answer, cb) {
  var ukey = 'unanswered!' + userHash;
  promptsUnansweredDB.get(ukey, function(err, unanswered) {
    if (err) return cb(err);
    promptsUnansweredDB.del(ukey, function(err) {
      if (err) return cb(err);
      var key = 'prompt!' + userHash + '!' + Date.now();
      unanswered.answer = answer;
      unanswered.answered = Date.now();
      promptsAnsweredDB.put(key, unanswered, function(err) {
        if (err) return cb(err);
        return cb(null);
      });
    })
  })
}