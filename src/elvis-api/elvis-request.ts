import Promise = require('bluebird');
import { UriOptions, UrlOptions, CoreOptions } from 'request';
import fs = require('fs');

var request = require('request').defaults({ jar: true });

export class HttpError extends Error {
  constructor(public message: string, public statusCode: number, public options: (UriOptions & CoreOptions) | (UrlOptions & CoreOptions)) {
    super(message);
  }
}

export class ElvisRequest {

  private csrfToken: string;

  constructor(private serverUrl: string, private username: string, private password: string) {
  }

  public request(options: (UriOptions & CoreOptions) | (UrlOptions & CoreOptions)): Promise<any> {
    return this.apiRequest(options).catch(error => {
      if (error.statusCode == 401) {
        // Not logged in, login first
        return this.authenticate().then(() => {
          // Retry initial call
          return this.apiRequest(options);
        });
      } else {
        throw error;
      }
    });
  }

  public requestFile(url: string, destination: string): Promise<any> {
    return this.fileRequest(url, destination).catch(error => {
      if (error.statusCode == 401) {
        // Not logged in, login first
        return this.authenticate().then(() => {
          // Retry initial call
          return this.fileRequest(url, destination);
        });
      } else {
        throw error;
      }
    });
  }

  private authenticate(): Promise<any> {
    var options = {
      method: 'POST',
      url: this.serverUrl + '/services/login?username=' + this.username + '&password=' + this.password
    }
    console.log('Not logged in, logging in...');
    return this.apiRequest(options).then(response => {
      if (!response.loginSuccess) {
        throw new HttpError(response.loginFaultMessage, 401, options);
      } else {
        console.log('Login successful!');
        if (response.csrfToken) {
          // Elvis 6+ login
          this.csrfToken = response.csrfToken;
        }
        return response;
      }
    });
  }

  private addCsrfToken(options): void {
    if (this.csrfToken) {
      // Elvis 6+
      if (!options.headers) {
        options.headers = {};
      }
      options.headers['X-CSRF-TOKEN'] = this.csrfToken;
    }
  }

  private apiRequest(options: (UriOptions & CoreOptions) | (UrlOptions & CoreOptions)): Promise<any> {
    return new Promise((resolve, reject) => {
      options.json = true;
      this.addCsrfToken(options);
      request(options, (error, response, body) => {
        if (error) {
          // Handle generic errors, for example unknown host
          reject(new HttpError('Elvis request failed: ' + error, 0, options));
        }

        if (body.errorcode) {
          response.statusCode = body.errorcode;
          response.statusMessage = body.message;
        }

        if (response.statusCode < 200 || response.statusCode > 299) {
          // Handle Elvis HTTP errors: 404, 401, 500, etc
          reject(new HttpError('Elvis request failed: ' + response.statusMessage, response.statusCode, options));
        }
        else {
          // All good, return API response
          resolve(body);
        }
      });
    });
  }

  private fileRequest(url: string, destination: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      let errorMsg: string = 'Download of ' + url + ' to: ' + destination + ' failed';
      let file: fs.WriteStream = fs.createWriteStream(destination);
      let options: any = {
        method: 'GET',
        url: url
      };
      this.addCsrfToken(options);

      let req = request(options)
        .on('error', (error) => {
          // Handle generic errors when getting the file, for example unknown host
          reject(new Error(errorMsg + ': ' + error));
        })
        .on('response', response => {

          // Handle Elvis HTTP errors: 404, 401, 500, etc
          if (response.statusCode < 200 || response.statusCode > 299) {
            reject(new HttpError(errorMsg, response.statusCode, options));
          }

          // Request went well, let's start piping the data...
          req.pipe(file)
            .on('error', (error) => {
              // Handle piping errors: unable to write file, stream closed, ...
              reject(new Error(errorMsg + ': ' + error));
            })
            .on('finish', () => {
              // Piping complete, we've got the file!
              resolve(destination);
            });
        });
    });
  }
}