'use strict';

module.exports = function HttpError(message, statusCode, options) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.statusCode = statusCode;
  this.options = options;
};

require('util').inherits(module.exports, Error);