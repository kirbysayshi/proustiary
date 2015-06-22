var path = require('path');
var test = require('tape');
var rimraf = require('rimraf');

var conf = require('../lib/conf');

// Inject a test db path for modules that require('./db')
var testDB = path.join(__dirname, './db');
conf.set('dbPath', testDB);

// Inject test prompts
conf.set('prompts', [
  { id: 0, blackout: 1, question: 'a' },
  { id: 1, blackout: 1, question: 'b' }
])

resetDB();

var prompts = require('../lib/prompts');

// Only for testing assertions.
var db = require('../lib/db')('prompt-metadata');

test('user with no existing metadata', function(t) {
  var userHash = 'user1';
  prompts.next(userHash, function(err, prompt) {
    t.ifErr(err);
    t.ok(prompt.id !== undefined, 'prompt.id');
    t.ok(prompt.question, 'prompt.question');

    db.get('metadata!' + userHash, function(err, metadata) {
      t.ifErr(err);
      var m = metadata[prompt.id];
      t.ok(m, 'metadata exists');
      t.equal(m.id, prompt.id, 'metadata id == prompt id');
      t.equal(m.decay, prompt.blackout, 'decay == blackout');
      t.end();
    })
  });
});

test('existing metadata', function(t) {
  var userHash = 'user1';
  prompts.next(userHash, function(err, prompt) {
    t.ifErr(err);
    t.ok(prompt.id !== undefined, 'prompt.id');
    t.ok(prompt.question, 'prompt.question');

    db.get('metadata!' + userHash, function(err, metadata) {
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

test('cleanup', function(t) {
  resetDB();
  t.end();
})


function resetDB() {
  // Kill any existing test DB
  rimraf.sync(testDB);
  require('fs').mkdirSync(testDB);
}