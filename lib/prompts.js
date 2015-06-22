var debug = require('debug')('prompts');

var chooser = require('./prompt-chooser');
var db = require('./db').register('prompt-metadata');
var conf = require('./conf');
var prompts = conf.get('prompts');

exports.next = function nextPrompt(userHash, cb) {
  var key = 'metadata!' + userHash;
  debug('nextPrompt requested', key);

  // get metadata
  db.get(key, function(err, metadata) {
    debug(key, err, metadata);
    if (err) metadata = {};

    // pass metadata and prompts into chooser
    chooser(metadata, prompts, function(err, prompt) {
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

      db.put(key, metadata, function(err) {
        debug('metadata-saved', err);
        cb(err, prompt);
      })
    })
  })
}