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
      res.statusCode = 502;
      res.write('Invalid Webhook Body');
      res.end();
      return;
    }

    User.getOrCreateFromPhoneNumber(parsed.From, function(err, userInfo) {
      if (err) {
        console.log(err);
        return;
      }
      DialogState.handle(userInfo, parsed.Body, function(err, message) {
        if (err) return twimlResponse(res, 200, err.message);
        if (message) twimlResponse(res, 200, message);
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