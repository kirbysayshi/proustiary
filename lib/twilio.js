var twilio = require('twilio');
var conf = require('./conf');

module.exports = function(sid, token) {
  if (!sid || !token) {
    console.error('Twilio credentials not found in local.json!');
    process.exit();
  }
  return twilio(sid, token);
}

