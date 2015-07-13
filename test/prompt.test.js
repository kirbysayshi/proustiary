var path = require('path');
var test = require('tape');
var rimraf = require('rimraf');

var conf = require('../lib/conf');

// Inject a test db path for modules that require('./db')
var testDB = path.join(__dirname, './db');
conf.set('dbPath', testDB);

conf.set('maxTimeBetweenPrompts', '2 seconds');
conf.set('minTimeBetweenPrompts', '1 second');

resetDB();

var prompt = require('../lib/prompt');

var db = require('../lib/db');
var promptsUnansweredDB = db('prompts-unanswered');
var promptsAnsweredDB = db('prompts-answered');
var promptsMetadataDB = db('prompts-metadata');

test('setup: prompts conf', function(t) {
  conf.set('prompts', [
    { id: 0, blackout: 1, question: 'a' },
    { id: 1, blackout: 1, question: 'b' }
  ])
  t.end();
});

test('next: user with no existing metadata', function(t) {
  var userHash = 'user1';
  prompt.next(userHash, function(err, prompt) {
    t.ifErr(err);
    t.ok(prompt.id !== undefined, 'prompt.id');
    t.ok(prompt.question, 'prompt.question');

    promptsMetadataDB.get('metadata!' + userHash, function(err, metadata) {
      t.ifErr(err);
      var m = metadata[prompt.id];
      t.ok(m, 'metadata exists');
      t.equal(m.id, prompt.id, 'metadata id == prompt id');
      t.equal(m.decay, prompt.blackout, 'decay == blackout');
      t.end();
    })
  });
});

test('next: existing metadata', function(t) {
  var userHash = 'user1';
  prompt.next(userHash, function(err, prompt) {
    t.ifErr(err);
    t.ok(prompt.id !== undefined, 'prompt.id');
    t.ok(prompt.question, 'prompt.question');

    promptsMetadataDB.get('metadata!' + userHash, function(err, metadata) {
      t.ifErr(err);
      var m = metadata[prompt.id];
      t.ok(m, 'metadata exists');
      t.equal(m.id, prompt.id, 'metadata id == prompt id');
      t.equal(m.decay, prompt.blackout, 'decay == blackout');

      delete metadata[prompt.id];
      var m = metadata[Object.keys(metadata)[0]];
      t.ok(m, 'previous metadata exists');
      t.equal(m.decay, 0, 'previous decay has been decremented');

      t.end();
    })
  });
});

test('setup: reset / prepare things', function(t) {
  conf.set('prompts', [
    { id: 0, blackout: 1, question: 'a' }
  ]);
  promptsMetadataDB.del('metadata!user1', function(err) {
    t.ifErr(err);
    t.end();
  });
});

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
    prompted: Date.now(),
    lastReminder: Date.now(),
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
      prompt.answer('user1', 'answer', function(err) {
        t.ifErr(err);
        promptsUnansweredDB.get('unanswered!user1', function(err) {
          t.ok(err instanceof Error, 'no longer unanswered');
          promptsAnsweredDB.createReadStream().on('data', function(data) {
            t.ok(data.value.prompted, 'prompted');
            t.ok(data.value.lastReminder, 'lastReminder');
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
