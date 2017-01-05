## co-yield-breakpoint

Add breakpoints around `yield` expression.

### Example

```
cd example && DEBUG=co-yield-breakpoint node index
```

**index.js**

```
'use strict';

require('..')({
  files: ['./foo.js']
});
require('./foo');
```

**NB**: You'd better put `require('co-yield-breakpoint')` on the top of main file, because `co-yield-breakpoint` rewrite `Module.prototype._compile`.

**foo.js**

```
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
```

After added breakpoints:

```
'use strict';
const co = require('co');
const Mongolass = require('mongolass');
const mongolass = new Mongolass();
mongolass.connect('mongodb://localhost:27017/test');
co(function* () {
  yield global.logger(this, function* () {
    return yield mongolass.model('users').create({
      name: 'xx',
      age: 18
    });
  }, 'mongolass.model(\'users\').create({\n    name: \'xx\',\n    age: 18\n})', '/Users/nswbmw/node/co-yield-breakpoint/example/foo.js:9:2');
  const users = yield global.logger(this, function* () {
    return yield mongolass.model('users').find();
  }, 'mongolass.model(\'users\').find()', '/Users/nswbmw/node/co-yield-breakpoint/example/foo.js:14:16');
  console.log('users: %j', users);
}).catch(e => console.error(e.stack));
```

As you see, co-yield-breakpoint wrap `YieldExpression` with:

```
global.logger(
  this,
  function*(){
    return yield YieldExpression
  },
  YieldExpressionString,
  filename
);
```

the console print:

```
{
  "filename": "/Users/nswbmw/node/co-yield-breakpoint/example/foo.js:9:2",
  "timestamp": "2016-11-10T13:53:33.053Z",
  "fn": "mongolass.model('users').create({\n    name: 'xx',\n    age: 18\n})",
  "result": {
    "result": {
      "ok": 1,
      "n": 1
    },
    "ops": [{
      "name": "xx",
      "age": 18,
      "_id": "58247bdd3fb205dbad5418a0"
    }],
    "insertedCount": 1,
    "insertedIds": [null, "58247bdd3fb205dbad5418a0"]
  },
  "take": 55
}
{
  "filename": "/Users/nswbmw/node/co-yield-breakpoint/example/foo.js:14:16",
  "timestamp": "2016-11-10T13:53:33.060Z",
  "fn": "mongolass.model('users').find()",
  "result": [{
    "_id": "58247bdd3fb205dbad5418a0",
    "name": "xx",
    "age": 18
  }],
  "take": 7
}
users: [{
  "_id": "58247bdd3fb205dbad5418a0",
  "name": "xx",
  "age": 18
}]
```

co-yield-breakpoint will print logs to console by default, if you want to save these logs to db, set `store` option, eg: [koa-yield-breakpoint-mongodb](https://github.com/nswbmw/koa-yield-breakpoint-mongodb).

**NB:** `take` is ms.

### SourceMap

co-yield-breakpoint also support source map.

**foo.js**

```
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



  console.log(haha);
  const users = yield mongolass.model('users').find();
  console.log('users: %j', users);
}).catch(e => console.error(e.stack));
```

Will output:

```
ReferenceError: haha is not defined
    at /Users/nswbmw/node/co-yield-breakpoint/example/foo.js:16:15
    at Generator.next (<anonymous>)
    at onFulfilled (/Users/nswbmw/node/co-yield-breakpoint/node_modules/co/index.js:65:19)
```

### Options

require('co-yield-breakpoint')(option)

- files{String[]}: files pattern, see [glob](https://github.com/isaacs/node-glob), required.
- store{Object}: backend store instance, see [koa-yield-breakpoint-mongodb](https://github.com/nswbmw/koa-yield-breakpoint-mongodb), default print to console.
- loggerName{String}: global logger name, default `logger`.
- yieldCondition{Function}: parameters `(filename, yieldExpression, parsedYieldExpression)`, return a object:
  - wrapYield{Boolean}: if `true` return wraped yieldExpression, default `true`.
  - deep{Boolean}: if `true` deep wrap yieldExpression, default `true`.
- others: see [glob](https://github.com/isaacs/node-glob#options).

### [koa-yield-breakpoint](https://github.com/nswbmw/koa-yield-breakpoint)

Add breakpoints around `yield` expression especially for koa@1.
