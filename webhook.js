var conf = require('./lib/conf');

var http = require('http');
var concat = require('concat-stream');
var querystring = require('querystring');

var User = require('./lib/user');
var Prompt = require('./lib/prompt');
var DialogState = require('./lib/dialog-state');

// Connect the job scheduler to the job immediately, since it needs to be
// defined before attempting to resume pending jobs.
Prompt.setJobHook(DialogState.onShouldSendPrompt);

http.createServer(function(req, res) {

  var parts = null;

  if ( (parts = /\/u\/(\+[0-9]{11})$/.exec(req.url)) ) {
    console.log('parts', parts);
    User.getOrCreateFromPhoneNumber(parts[1], function(err, userInfo) {
      if (err) {
        res.statusCode = 500;
        res.write('Error retrieving user');
        res.end();
        return;
      }

      res.statusCode = 200;

      require('./lib/db')('prompts-answered').createReadStream({
        lte: 'prompt!' + userInfo.hash + '!' + Date.now(),
        gte: 'prompt!' + userInfo.hash + '!' + 0,
        reverse: true
      })
      .on('data', function(data) {
        res.write(JSON.stringify(data.value) + '\n');
      })
      .on('end', function() {
        res.end();
      })
    })
    return;
  }

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

    if (!parsed || !parsed.From) {
      res.statusCode = 400;
      res.write('Invalid Webhook Body');
      res.end();
      return;
    }

    User.getOrCreateFromPhoneNumber(parsed.From, function(err, userInfo) {
      if (err) {
        console.log(err);
        res.statusCode = 500;
        res.write('Could not get or create user.');
        res.end();
        return;
      }
      DialogState.handle(userInfo, parsed.Body, function(err, message) {
        if (err) return twimlResponse(res, 200, err.message);
        if (message) return twimlResponse(res, 200, message);
        res.statusCode = 200;
        res.end();
      });
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