'use strict';

const sourceMapCache = {};
require('source-map-support').install({
  retrieveSourceMap: (source) => {
    const sourcemap = sourceMapCache[source];
    if (sourcemap) {
      return {
        map: sourcemap
      };
    }
    return null;
  }
});

const assert = require('assert');
const Module = require('module');

const _ = require('lodash');
const glob = require('glob');
const esprima = require('esprima');
const shimmer = require('shimmer');
const escodegen = require('escodegen');
const debug = require('debug')('co-yield-breakpoint');

const defaultOpt = {
  nodir: true,
  absolute: true,
  loggerName: 'logger'
};

module.exports = function (opt) {
  opt = _.defaults(opt || {}, defaultOpt);
  debug('options: %j', opt);

  const loggerName = opt.loggerName;
  const files = opt.files;
  const store = opt.store || { save: (record) => console.log('%j', record) };
  const yieldCondition = opt.yieldCondition;
  assert(files && _.isArray(files), '`files`{array} option required');
  assert(store && _.isFunction(store.save), '`store.save`{function} option required, see: koa-yield-breakpoint-mongodb');
  if (yieldCondition) {
    assert(_.isFunction(yieldCondition), '`yieldCondition` option must be function');
  }

  // add global logger
  global[loggerName] = function *(ctx, fn, fnStr, filename) {
    const start = Date.now();
    let result;
    let error;

    try {
      result = yield fn.call(ctx);
    } catch (e) {
      error = e;
    }
    const timestamp = new Date();
    const record = {
      filename,
      timestamp,
      fn: fnStr,
      result,
      take: timestamp - start
    };
    if (error) {
      record.error = error;
    }
    debug(record);
    store.save(record);

    if (error) {
      throw error;
    } else {
      return result;
    }
  };

  let filenames = [];
  files.forEach(filePattern => {
    filenames = filenames.concat(glob.sync(filePattern, opt));
  });
  filenames = _.uniq(filenames);
  debug('matched files: %j', filenames);

  // wrap Module.prototype._compile
  shimmer.wrap(Module.prototype, '_compile', function (__compile) {
    return function coBreakpointCompile(content, filename) {
      if (!_.includes(filenames, filename)) {
        return __compile.call(this, content, filename);
      }

      let parsedCodes;
      try {
        parsedCodes = esprima.parse(content, { loc: true });
      } catch (e) {
        console.error('cannot parse file: %s', filename);
        console.error(e.stack);
        process.exit(1);
      }

      findYieldAndWrapLogger(parsedCodes);
      try {
        content = escodegen.generate(parsedCodes, {
          format: { indent: { style: '  ' } },
          sourceMap: filename,
          sourceMapWithCode: true
        });
      } catch (e) {
        console.error('cannot generate code for file: %s', filename);
        console.error(e.stack);
        process.exit(1);
      }
      debug('file %s regenerate codes:\n%s', filename, content.code);

      // add to sourcemap cache
      sourceMapCache[filename] = content.map.toString();
      return __compile.call(this, content.code, filename);

      function findYieldAndWrapLogger(node) {
        if (!node || typeof node !== 'object') {
          return;
        }
        let condition = {
          wrapYield: true,
          deep: true
        };

        if (node.hasOwnProperty('type') && node.type === 'YieldExpression' && !node.__skip) {
          const codeLine = node.loc.start;
          const __argument = node.argument;
          const __expressionStr = escodegen.generate(__argument);
          const expressionStr = `
            global.${loggerName}(
              this,
              function*(){
                return yield ${__expressionStr}
              },
              ${JSON.stringify(__expressionStr)},
              ${JSON.stringify(filename + ':' + codeLine.line + ':' + codeLine.column)}
            )`;

          if (yieldCondition) {
            condition = yieldCondition(filename, __expressionStr, __argument) || condition;
            assert(typeof condition === 'object', '`yieldCondition` must return a object');
          }
          if (condition.wrapYield) {
            try {
              node.argument = esprima.parse(expressionStr, { loc: true }).body[0].expression;
              try {
                // skip process this YieldExpression
                node.argument.arguments[1].body.body[0].argument.__skip = true;
                // try correct loc
                node.argument.arguments[1].body.body[0].argument.argument = __argument;
              } catch (e) {/* ignore */}
            } catch (e) {
              console.error('cannot parse expression:');
              console.error(expressionStr);
              console.error(e.stack);
              process.exit(1);
            }
          }
        }
        if (condition.deep) {
          for (const key in node) {
            if (node.hasOwnProperty(key)) {
              findYieldAndWrapLogger(node[key]);
            }
          }
        }
      }
    };
  });
};
