var debug = require('debug')('dialog-state');
var conf = require('./conf');
var twilio = require('./twilio')(conf.get('twilioSID'), conf.get('twilioTOKEN'));
var User = require('./user');
var Prompt = require('./prompt');

var States = {};
[
  'NO_STATE',
  'NEW_USER',
  'WAITING_FOR_VERIFICATION',
  'VERIFIED',
  'READY_FOR_PROMPT',
  'PROMPT_QUEUED',
  'WAITING_FOR_RESPONSE'
].forEach(function(key) {
  States[key] = key;
});

// next() is assumed to accept two signatures. If either is defined a message
// will be received by the user via twiml.
// next(err) -> display err.message to the user
// next(null, 'message') -> display 'message' to the user
function handle(userInfo, body, next) {
  userInfo.state = userInfo.state || States.NO_STATE;
  debug(userInfo.state, userInfo);
  if (!handles[userInfo.state]) {
    return next(new Error('Invalid user state: ' + state));
  }
  handles[userInfo.state](userInfo, body, next);
}

exports.handle = handle;
exports.onShouldSendPrompt = onShouldSendPrompt;
exports.onShouldSendReminder = onShouldSendReminder;

// This has to be here, otherwise the damn prompter needs to know state stuff.
function onShouldSendPrompt(payload, done) {
  debug('exec', payload);
  User.getFromHash(payload.hash, function(err, userInfo) {
    debug('prompting', userInfo, payload);
    twilio.sendMessage({
      to: userInfo.number,
      from: conf.get('twilioNumber'),
      body: payload.prompt.question
    }, function(err, res) {
      // TODO: handle STOP errors : { status: 400,
      // message: 'The message From/To pair violates a blacklist rule.',
      // code: 21610,
      // moreInfo: 'https://www.twilio.com/docs/errors/21610' }
      if (err) return done(err);
      userInfo.state = States.WAITING_FOR_RESPONSE;
      User.save(userInfo, function(err) {
        if (err) return done(err);
        payload.prompt.prompted = payload.prompt.lastReminder = Date.now();
        Prompt.saveUnanswered(payload.hash, payload.prompt, function(err) {
          debug('saved unanswered?', err);
          if (err) return done(err);
          return done(null);
        });
      });
    });
  });
}

function onShouldSendReminder(payload) {
  debug('exec', payload);
  User.getFromHash(payload.hash, function(err, userInfo) {
    debug('reminding', userInfo, payload);
    twilio.sendMessage({
      to: userInfo.number,
      from: conf.get('twilioNumber'),
      body: payload.prompt
    }, function(err, res) {
      if (err) return debug('failed to remind user', err);
      payload.unansweredPrompt.lastReminder = Date.now();
      Prompt.saveUnanswered(payload.hash, payload.unansweredPrompt, function() {
        debug('updated unanswered', arguments)
      });
    });
  });
}

var handles = {};

handles[States.NO_STATE] = function(userInfo, body, next) {
  userInfo.state = States.NEW_USER;
  User.save(userInfo, function(err) {
    if (err) return next(err);
    handle(userInfo, body, next);
  });
}

handles[States.NEW_USER] = function(userInfo, body, next) {
  twilio.sendMessage({
    to: userInfo.number,
    from: conf.get('twilioNumber'),
    body: ''
      + 'Welcome to ' + conf.get('publicName') + '! \n'
      + 'If you\'d like to join, send back something positive, like "YES".\n'
      + 'If not, ignore!\n'
      + 'For more info, visit ' + conf.get('publicAddress')
  }, function(err, res) {
    if (err) return next(err);
    userInfo.state = States.WAITING_FOR_VERIFICATION;
    User.save(userInfo, function(err) {
      if (err) return next(err);
      return next();
    });
  });
}

handles[States.WAITING_FOR_VERIFICATION] = function(userInfo, body, next) {
  if (!body) {
    return next(new Error('No input received for state '
      + States.WAITING_FOR_VERIFICATION));
  }

  var normalized = body.trim().toLowerCase();

  debug('verification normalized', normalized);

  if (normalized === 'yes'
    || normalized === 'yeah'
    || normalized === 'ok'
    || normalized === 'go'
    || normalized === 'awesome'
    || normalized === 'radical'
    || normalized === 'woo'
    || normalized === 'wooo'
    || normalized === 'cool'
    || normalized === 'coo'
  ) {
    userInfo.state = States.VERIFIED;
    User.save(userInfo, function(err) {
      if (err) return next(err);
      handle(userInfo, body, next);
    });
  } else {
    twilio.sendMessage({
      to: userInfo.number,
      from: conf.get('twilioNumber'),
      body: ''
        + 'Sorry, I didn\'t understand that. '
        + 'Could you reply with either a YES or just ignore me?'
    }, function(err, res) {
      if (err) return next(err);
      return next(null);
    });
  }
}

handles[States.VERIFIED] = function(userInfo, body, next) {
  twilio.sendMessage({
    to: userInfo.number,
    from: conf.get('twilioNumber'),
    body: ''
      + 'Thanks for joining! Expect your first prompt within a bit.'
  }, function(err, res) {
    if (err) return next(err);
    userInfo.state = States.READY_FOR_PROMPT;
    User.save(userInfo, function(err) {
      if (err) return next(err);
      handle(userInfo, body, next);
    });
  });
}

handles[States.READY_FOR_PROMPT] = function(userInfo, body, next) {
  Prompt.schedule(userInfo.hash, function(err) {
    if (err) return next(err);
    userInfo.state = States.PROMPT_QUEUED;
    User.save(userInfo, function(err) {
      if (err) return next(err);
      return next(null);
    });
  });
}

handles[States.PROMPT_QUEUED] = function(userInfo, body, next) {
  if (body) return next(new Error('How nice! But I haven\'t asked you anything yet.'));
  else return next(null);
}

handles[States.WAITING_FOR_RESPONSE] = function(userInfo, body, next) {
  // TODO: handle rich media, like selfies
  if (!body) return next(new Error('I missed your response. Try again?'));
  Prompt.answer(userInfo.hash, body, function(err) {
    if (err) return next(err);
    userInfo.state = States.READY_FOR_PROMPT;
    User.save(userInfo, function(err) {
      if (err) return next(err);
      handle(userInfo, body, next);
    })
  })
}
