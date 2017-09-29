import fs = require('fs');
import { Config } from '../../config';

export abstract class Google {

  protected validateConfig(): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.exists(Config.googleKeyFilename, exists => {
        // We have to check ourselves as Google throws weird errors when there's no valid path specified.
        // For example when people configure an API key instead of a path to a key file.
        if (!exists) {
          return reject(Error('The file specified in googleKeyFilename doesn\'t exists: "' + Config.googleKeyFilename + '". Please configure the correct full file path to the Google Service account keyfile.'));
        }
        resolve('');
      });
    });
  }

}

