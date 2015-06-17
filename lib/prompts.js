var debug = require('debug')('prompts');

var db = require('./db').register('prompts');
var conf = require('./conf');

exports.next = function nextPrompt(userHash, cb) {
  var key = 'prompts!' + userHash;
  debug('nextPrompt requested', key);

  db.get(key, function(err, prompts) {
    if (err) {
      // there are no prompts, init!
      debug('no prompts', key);
      prompts = conf.get('prompts').map(function(prompt) {
        prompt.prompted = false;
        return prompt;
      });

      debug('PUT prompts', key, prompts);
      db.put(key, prompts, function(err) {
        debug('PUTed prompts', key, err);
        if (err) return cb(err);
        return nextPrompt(userHash, cb);
      });

      return;
    }

    var unprompted = prompts.filter(function(prompt) {
      return !prompt.prompted;
    }).sort(function(a, b) {
      // sort DESC
      return b.weight - a.weight;
    });

    debug('filter-sorted %d unprompted prompts', unprompted.length);

    if (!unprompted.length) {
      // reset all of them by deleting them and re-inserting
      debug('no unprompted found, deleting')
      db.del(key, function(err) {
        if (err) return cb(err);
        return nextPrompt(userHash, cb);
      });
      return;
    }

    var totalWeight = unprompted.reduce(function(sum, curr) {
      return sum + curr.weight;
    }, 0);

    var roll = Math.floor(Math.random() * totalWeight);

    debug('totalWeight', totalWeight);
    debug('roll', roll);

    var prompt = unprompted.filter(function(prompt) {
      return prompt.weight <= roll;
    })[0];

    if (!prompt) prompt = unprompted[0];

    debug('prompt', prompt);

    var idx = prompts.indexOf(prompt);
    debug('prompt %d', idx, prompt);

    prompts[idx].prompted = true;

    db.put(key, prompts, function(err) {
      debug('stored', err);
      if (err) return cb(err);
      return cb(null, prompt);
    })
  });
}