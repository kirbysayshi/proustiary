var test = require('tape');
var pc = require('../lib/prompt-chooser');

test('empty metadata', function(t) {
  var m = {};

  var prompts = [
    { id: 0, blackout: 1, question: 'a' },
    { id: 1, blackout: 1, question: 'b' }
  ];

  pc(m, prompts, function(err, prompt) {
    t.ifErr(err);
    t.ok(prompt);
    t.end();
  });
})

test('blacked out metadata excludes', function(t) {
  var m = {
    '1': { id: 1, decay: 5 }
  };

  var prompts = [
    { id: 0, blackout: 1, question: 'a' },
    { id: 1, blackout: 5, question: 'b' }
  ];

  pc(m, prompts, function(err, prompt) {
    t.ifErr(err);
    t.equal(prompt, prompts[0]);
    t.end();
  });
})

test('all blacked out', function(t) {
  var m = {
    '0': { id: 0, decay: 5 },
    '1': { id: 1, decay: 5 }
  };

  var prompts = [
    { id: 0, blackout: 1, question: 'a' },
    { id: 1, blackout: 5, question: 'b' }
  ];

  pc(m, prompts, function(err, prompt) {
    t.ok(err, 'returns error')
    t.end();
  });
})
