var HttpError = require('./http-error.js')
var Promise = require('bluebird');
var request = Promise.promisify(require('request').defaults({ jar: true }), { multiArgs: true });
Promise.promisifyAll(request, { multiArgs: true })

module.exports = (config) => {

  function cloneObj(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function parseBody(result) {
    try {
      return JSON.parse(result[1]);
    } catch (err) {
      return result[1];
    }
  }

  function authenticate() {
    var options = {
      url: (config.useBaseUrl ? '' : config.serverUrl) + '/services/login?username=' + config.username + '&password=' + config.password
    }
    console.log('Not logged in, logging in...');
    return requestWithBodyErrorHandling(options).then(result => {
      var body = config.parseJSON ? result : parseBody(result);

      if (!body.loginSuccess) {
        throw new HttpError(body.loginFaultMessage, 401, options);
      } else {
        console.log('Login successful!');
        return result;
      }
    });
  }

  function requestWithBodyErrorHandling(options) {
    if (config.useBaseUrl) {
      if (options.uri) {
        options.uri = config.serverUrl + options.uri;
      }
      else {
        options.url = config.serverUrl + options.url;
      }
    }

    return request(options).then(result => {
      var response = result[0];
      var body = parseBody(result);

      if (body.errorcode) {
        response.statusCode = body.errorcode;
        response.statusMessage = body.message;
      }

      // console.log('Elvis Response ' + JSON.stringify({
      //   statusCode: response.statusCode,
      //   options: options
      // }, null, 2));

      if (response.statusCode < 200 || response.statusCode > 299) {
        throw new HttpError(response.statusMessage, response.statusCode, options);
      } else if (config.parseJSON) {
        return body;
      } else {
        return result;
      }
    });
  }

  return (options) => {
    return requestWithBodyErrorHandling(cloneObj(options)).catch(error => {
      if (error.statusCode == 401) {
        return authenticate().then(() => {
          return requestWithBodyErrorHandling(options);
        });
      } else {
        throw error;
      }
    });
  }
}
