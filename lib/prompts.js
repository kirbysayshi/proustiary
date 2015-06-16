
module.exports = function(user, questions) {

  var asked = [];
  var unasked = questions.slice(0);

  return function() {
    if (unasked.length === 0) {
      // This will be a problem if the question count gets long...
      unasked.push.apply(unasked, asked);
      asked.length = 0;
    }

    var idx = Math.floor(Math.random() * unasked.length);
    if (idx === unasked.length) idx = unasked.length - 1;
    var picked = unasked.splice(idx, 1);
    asked.push(picked);
    return picked;
  }
}