var debug = require('debug')('prompt');
var hdate = require('human-date');
var hinterval = require('human-interval');
var db = require('./db');
var promptsUnansweredDB = db.register('prompts-unanswered');
var promptsAnsweredDB = db.register('prompts-answered');
var promptsMetadataDB = db.register('prompts-metadata');
var scheduler = require('level-schedule')(db.register('prompt-scheduler'));
var random = require('./random');

var chooser = require('./prompt-chooser');
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
  nextPrompt(userHash, function(err, nextPrompt) {
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

    var arriveIn = random().nextInt(min, max);
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
// TODO: this doesn't really need to be exposed...
var nextPrompt = exports.next = function(userHash, cb) {
  var key = 'metadata!' + userHash;
  debug('nextPrompt requested', key);

  // get metadata
  promptsMetadataDB.get(key, function(err, metadata) {
    debug(key, err, metadata);
    if (err) metadata = {};

    // pass metadata and prompts into chooser
    chooser(metadata, conf.get('prompts'), function(err, prompt) {
      debug('chose', err, prompt);
      if (err) return cb(err);

      // decrement all metadata decays by 1
      Object.keys(metadata).forEach(function(id) {
        if (metadata[id].decay > 0) metadata[id].decay--;
      });

      // take chosen prompt and store along with metadata
      var m = metadata[prompt.id] || (metadata[prompt.id] = { id: prompt.id, decay: 0 });
      m.decay = prompt.blackout;

      debug('metadata-ready', metadata);

      promptsMetadataDB.put(key, metadata, function(err) {
        debug('metadata-saved', err);
        cb(err, prompt);
      })
    })
  })
}
