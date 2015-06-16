var conf = require('./lib/conf');
var twilio = require('./lib/twilio')(conf.get('twilioSID'), conf.get('twilioTOKEN'));
var http = require('http');
var concat = require('concat-stream');
var querystring = require('querystring');

var usersDB = require('./lib/db').register('users');
var promptsDB = require('./lib/db').register('prompts');
var jobsDB = require('level-schedule')(require('./lib/db').register('jobs'));

var PROMPT_JOB_KEY = 'promptjob';
jobsDB.job(PROMPT_JOB_KEY, function(payload, done) {
  console.log('JOB RUN GO!', payload);
  done(null);
});

// TODO: somehow break this twilio dialog tree into something comprehensible

// TODO: use a uuid instead of the user's phone number as an ID

http.createServer(function(req, res) {

  if (req.url !== '/twebhook') {
    res.statusCode = 404;
    res.write('Unknown');
    res.end();
    return;
  }

  console.log('webhook', req.headers);

  req.pipe(concat(function(body) {
    var parsed = querystring.parse(body.toString());

    console.log('webhook body', body.toString());
    console.log('webhook body parsed', parsed);
    console.log('FROM number', parsed.From);

    getUser(parsed.From, function(err, userInfo) {
      if (!err) {
        console.log('found user', userInfo);
        // user exists, check if this is a verification response
        var normaled = parsed.Body.trim().toLowerCase()

        if (userInfo.verified === false) {
          if (normaled === 'yes'
            || normaled === 'yeah'
            || normaled === 'ok'
            || normaled === 'go'
            || normaled === 'awesome'
            || normaled === 'radical'
            || normaled === 'woo'
            || normaled === 'wooo'
            || normaled === 'cool'
            || normaled === 'coo'
          ) {
            verifyUser(userInfo, function(err) {
              console.log('user verified if null', err);
              // TODO: queue user to receive prompts!
              if (err) return twimlResponse(res, 200, 'Something went wrong saving your user info.');
              else {
                jobsDB.run(PROMPT_JOB_KEY, {userInfo: userInfo}, Date.now() + 10000);
                return twimlResponse(res, 200, 'Thanks for joining! Expect a prompt within a bit.');
              }
            })
          } else {
            console.log('bad verification response');
            twimlResponse(res, 200, 'Sorry, I didn\'t understand that. Could you reply with either a YES or just ignore me?');
          }
          return;
        }

        // grab last question asked, store answer
        getLatestUnansweredPrompt(parsed.From, function(err, latest) {
          if (err || !latest) return twimlResponse(res, 200, 'Not sure what you mean, I didn\'t ask you a question yet.');

          console.log('found latest prompt', latest);
          latest.value.answer = parsed.Body;
          savePrompt(parsed.From, latest.key, latest.value, function(err) {
            if (err) return twimlResponse(res, 200, 'Failed to save prompt response, try again.');
            else twimlResponse(res, 200, 'Thanks.');
          })
        })
        return;
      }

      // New user, create
      sendCreateVerification(parsed.From, function(err, userInfo) {
        if (err) return twimlResponse(res, 200, 'Sorry, something went wrong creating your account.');
      })
    });
  }))

}).listen(conf.get('port'));

function twimlResponse(res, code, msg) {
  var xml = '<?xml version="1.0" encoding="utf-8" ?>'
    + '<Response>'
    + '<Message>' + msg + '</Message>'
    + '</Response>';

  res.writeHead(200, {
    'Content-Type': 'text/xml',
    'Content-Length': xml.length
  });

  res.write(xml);
  res.end();
}

function getUser(from, next) {
  usersDB.get('user!' + from, function(err, user) {

    if (!err) {
      return next(err, user);
    }

    return next(err);
  });
}

function verifyUser(userInfo, next) {
  userInfo.verified = true;
  usersDB.put('user!' + userInfo.number, userInfo, function(err) {
    return next(err);
  })
}

function sendCreateVerification(from, next) {
  var userInfo = {
    number: from,
    joined: Date.now(),
    verified: false
  }

  usersDB.put('user!' + from, userInfo, function(err) {
    if (err) {
      return next(err);
    }

    twilio.sendMessage({
      to: from,
      from: conf.get('twilioNumber'),
      body: ''
        + 'Welcome to Question-Book! \n'
        + 'If you\'d like to join, send back something positive, like "YES".\n'
        + 'If not, ignore!\n'
        + 'For more info, visit ' + conf.get('publicAddress')
    }, function(err, res) {
      if (err) {
        console.error(err);
        return next(err);
      }
      return next(null, userInfo);
    });
  });
}

function getLatestUnansweredPrompt(from, next) {
  var prompts = promptsDB.createReadStream({
    gte: 'prompts!' + from + '!' + (Date.now() - conf.get('maxTimeBetweenPrompts'))
  });

  prompts.pipe(concat(function(all) {
    var latest = all.pop();
    if (!latest) return next(null, null);
    if (latest.value.answer !== null) return next(null, null);
    return next(null, latest);
  }));
}

function savePrompt(from, prompt, key, next) {
  prompt.answer = prompt.answer || null
  key = key || 'prompts!' + from + '!' + Date.now();
  promptsDB.put(key, prompt, function(err) {
    return next(err);
  });
}