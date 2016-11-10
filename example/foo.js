'use strict';

const co = require('co');
const Mongolass = require('mongolass');
const mongolass = new Mongolass();
mongolass.connect('mongodb://localhost:27017/test');

co(function* () {
  yield mongolass.model('users').create({
    name: 'xx',
    age: 18
  });

  const users = yield mongolass.model('users').find();
  console.log('users: %j', users);
}).catch(e => console.error(e.stack));
