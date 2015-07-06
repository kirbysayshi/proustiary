var arbit = require('arbit');
var generator = null

// seed should be a string, but arbit converts it to a string regardless
module.exports = function(opt_seed) {
  if (!generator) {
    if (opt_seed === undefined) opt_seed0 = parseFloat('0.' + Date.now(), 10);
    generator = arbit(opt_seed);
  }
  return generator;
}