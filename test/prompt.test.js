var path = require('path');
var test = require('tape');
var rimraf = require('rimraf');

var conf = require('../lib/conf');

// Inject a test db path for modules that require('./db')
var testDB = path.join(__dirname, './db');
conf.set('dbPath', testDB);

conf.set('maxTimeBetweenPrompts', '2 seconds');
conf.set('minTimeBetweenPrompts', '1 second');

// Inject test prompts
conf.set('prompts', [
  { id: 0, blackout: 1, question: 'a' }
]);

resetDB();

var prompt = require('../lib/prompt');

var db = require('../lib/db');
var promptsUnansweredDB = db('prompts-unanswered');
var promptsAnsweredDB = db('prompts-answered');

test('schedule', function(t) {
  prompt.setJobHook(function(payload, done) {
    t.ok(payload);
    t.equal(payload.hash, 'user1');
    t.deepEqual(payload.prompt, {
      prompted: null,
      answered: null,
      promptId: 0,
      question: 'a',
      answer: null
    });
    done();
    t.end();
  })

  prompt.schedule('user1', function(err) {
    t.ifErr(err);
  });
});

test('answer', function(t) {
  var p = {
    prompted: null,
    answered: null,
    promptId: 0,
    question: 'a',
    answer: null
  }

  prompt.saveUnanswered('user1', p, function(err) {
    t.ifErr(err);
    promptsUnansweredDB.get('unanswered!user1', function(err, unanswered) {
      t.ifErr(err);
      t.ok(unanswered);
      t.ok(unanswered.prompted !== null, 'prompted is not null');
      prompt.answer('user1', 'answer', function(err) {
        t.ifErr(err);
        promptsUnansweredDB.get('unanswered!user1', function(err) {
          t.ok(err instanceof Error, 'no longer unanswered');
          promptsAnsweredDB.createReadStream().on('data', function(data) {
            t.ok(data.value.prompted, 'prompted');
            t.ok(data.value.answered, 'answered');
            t.equal(data.value.answer, 'answer');
            t.equal(data.value.promptId, 0, 'promptId');
            t.end();
          })
        })
      })
    });
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