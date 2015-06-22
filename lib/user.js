var debug = require('debug')('user');
var crypto = require('crypto');
var conf = require('./conf');
var usersDB = require('./db').register('users');

exports.getFromHash = function(hash, cb) {
  usersDB.get('user!' + hash, function(err, userInfo) {
    if (err) return cb(err);
    return cb(null, userInfo);
  })
}

exports.getOrCreateFromPhoneNumber = function(number, cb) {
  var shasum = crypto.createHash('sha1');
  shasum.update(conf.get('secretSalt') + '!' + number);
  var hash = shasum.digest('hex');
  //bcrypt.hash(number, conf.get('secretSalt'), function(err, hash) {
    //if (err) return cb(err);
    usersDB.get('user!' + hash, function(err, userInfo) {
      if (err) {
        userInfo = {
          hash: hash,
          number: number,
          joined: Date.now(),
          state: null
        }
        usersDB.put('user!' + hash, userInfo, function(err) {
          if (err) return cb(err);
          else return cb(null, userInfo);
        });
        return;
      } else {
        return cb(null, userInfo);
      }
    });
  //});
}

exports.save = function(userInfo, cb) {
  usersDB.put('user!' + userInfo.hash, userInfo, function(err) {
    debug('saved', err, userInfo);
    if (err) return cb(err);
    else return cb(null, userInfo);
  })
}