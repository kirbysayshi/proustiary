var db = require('./db')
var promptsUnansweredDB = db.register('prompts-unanswered');
var promptsAnsweredDB = db.register('prompts-answered');
var scheduler = require('level-schedule')(db.register('prompt-scheduler'));

var User = require('./user');
var conf = require('./conf');

var PROMPT_JOB_NAME = 'send-prompt';

exports.setJobHook = function(cb) {
  scheduler.job(PROMPT_JOB_NAME, cb);
}

exports.schedule = function(userHash, cb) {
  // TODO: generate a real prompt...

  var prompt = {
    prompted: null,
    answered: null,
    question: 'a question for you',
    answer: null
  }

  scheduler.run(PROMPT_JOB_NAME, {
    hash: userHash,
    prompt: prompt
  }, Date.now() + 10000);
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