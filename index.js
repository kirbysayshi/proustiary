var hinterval = require('human-interval');
var hdate = require('human-date');

var conf = require('./lib/conf');
console.log(conf.get('prompts'))
var twilio = require('./lib/twilio')(conf.get('twilioSID'), conf.get('twilioTOKEN'));
var prompts = require('./lib/prompts')(conf.get('userNumber'), conf.get('prompts'));

Object.keys(require('./local-dist.json'))
.forEach(function(key) {
  if (!conf.get(key)) {
    throw new Error(''
      + 'Could not find "' + key + '" in conf. '
      + 'Be sure you copied local-dist.json to local.json and filled in your '
      + 'specific values.');
  }
});

// Convert string durations into ms.
['minTimeBetweenPrompts', 'maxTimeBetweenPrompts']
.forEach(function(key) {
  var hr = conf.get(key);
  var ms = hinterval(conf.get(key));
  conf.set(key, ms);
  console.log('transforming', key, hr, ms);
});

// TODO: handle doNotDisturb using https://github.com/toberndo/interval-query

(function go() {

  var prompt = prompts();
  var payload = {
    to: conf.get('userNumber'),
    from: conf.get('twilioNumber'),
    body: prompt
  };

  console.log('payload', payload);

  twilio.sendMessage(payload, function(err, response) {
    if (err) return console.log(err);
    console.log(response);
  });

  var next = getNextPromptTime();
  console.log('next scheduled', hdate.relativeTime(next/1000), next);
  setTimeout(go, next);
}())

function getNextPromptTime() {
  return Math.random() * conf.get('maxTimeBetweenPrompts') - conf.get('minTimeBetweenPrompts');
}

