var debug = require('debug')('prompt');
var db = require('./db');
var promptsUnansweredDB = db.register('prompts-unanswered');
var promptsAnsweredDB = db.register('prompts-answered');
var scheduler = require('level-schedule')(db.register('prompt-scheduler'));

var Prompts = require('./prompts');
var User = require('./user');
var conf = require('./conf');

var PROMPT_JOB_NAME = 'send-prompt';

exports.setJobHook = function(cb) {
  scheduler.job(PROMPT_JOB_NAME, cb);
}

exports.schedule = function(userHash, cb) {
  Prompts.next(userHash, function(err, nextPrompt) {
    if (err) return cb(err);

    var prompt = {
      prompted: null,
      answered: null,
      question: nextPrompt.question,
      answer: null
    }

    var max = conf.get('maxTimeBetweenPrompts');
    var min = conf.get('minTimeBetweenPrompts');

    var arriveAt = process.env.DEV
      ? Date.now() + 10000
      : Date.now() + (Math.random() * max - min);

    debug('scheduled', arriveAt, userHash, prompt);

    scheduler.run(PROMPT_JOB_NAME, {
      hash: userHash,
      prompt: prompt
    }, arriveAt);
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