var debug = require('debug')('prompt-chooser');
var random = require('./random');

// array of current user prompt metadata come in from db
// array of all prompts come in from config
// return cb(null, prompt)

// metadata: {
//   promptId: { id, decay }
// }

// prompts: [
//   { id, blackout, question }
// ]

// It is assumed that metadata will be bulk-saved per user

module.exports = function(metadata, prompts, cb) {
  // find an eligible prompt (supress == 0)

  var eligibles = prompts.filter(function(p) {
    var m = metadata[p.id];
    debug('filter', m, !m)
    return !m || !m.decay;
  });

  if (!eligibles.length) {
    var msg = 'Could not find any eligible prompts.';
    var e = new Error(msg);
    e.name = 'InvalidPromptConfiguration';
    return cb(e);
  }

  var roll = random().nextInt(0, eligibles.length);
  var prompt = eligibles[roll];

  debug('rollRange', 0, eligibles.length-1);
  debug('roll', roll);
  debug('prompt', prompt);

  return cb(null, prompt);
}