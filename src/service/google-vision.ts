import vision = require('@google-cloud/vision');
import fs = require('fs');
import { Config } from '../config';
import { ServiceResponse } from './service-response';

/**
 * Uses the Google Vision API to detect tags and locations in the given image.
 */
export class GoogleVision {

  private gv;

  constructor() {
    fs.exists(Config.googleKeyFilename, exists => {
      // We have to check ourselves as Google throws weird errors when there's no valid path specified.
      // For example when people configure an API key instead of a path to a key file.
      if (!exists) {
        throw new Error('The file specified in googleKeyFilename doesn\'t exists: "' + Config.googleKeyFilename + '". Please configure the correct full file path to the Google Service account keyfile.');
      }
      this.gv = vision({
        keyFilename: Config.googleKeyFilename
      });
    });
  }

  /**
   * Detect tags & locations
   * 
   * @param inputFile Full path to the image to analyze
   */
  public detect(inputFile): Promise<ServiceResponse> {
    return new Promise((resolve, reject) => {

      let params = {
        types: ['labels', 'landmarks'],
        verbose: true
      };

      this.gv.detect(inputFile, params, (error, response) => {
        if (error) {
          return reject(new Error('An error occurred while getting the labels from Google Vision: ' + error));
        }

        var sr = new ServiceResponse();

        response.labels.forEach(label => {
          sr.tags.push(label.desc.toLowerCase());
        });

        if (response.landmarks !== undefined && response.landmarks.length > 0) {
          let landmarks = response.landmarks;
          sr.metadata['gpsLatitude'] = landmarks[0].locations[0].latitude;
          sr.metadata['gpsLongitude'] = landmarks[0].locations[0].longitude;
          let locations = [];
          landmarks.forEach(landmark => {
            // Google sometimes gives us duplicate landmarks...
            if (!locations.includes(landmark.desc))
              locations.push(landmark.desc);
          });
          sr.metadata['shownSublocation'] = locations.join(', ');
        }

        if (Config.googleTagsField && sr.tags.length > 0) {
          sr.metadata[Config.googleTagsField] = sr.tags.join(',');
        }

        resolve(sr);
      });
    });
  }
}

