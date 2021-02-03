import Promise = require('bluebird');
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Google } from './google-base';
import { Config } from '../../config';
import { ServiceResponse } from './service-response';

/**
 * Uses the Google Vision API to detect tags and locations in the given image.
 */
export class GoogleVision extends Google {

  private gv:ImageAnnotatorClient;
  private readFile: Function = Promise.promisify(require("fs").readFile);

  private static MIN_LABEL_SCORE:number = 0.5;
  private static MIN_LOGO_SCORE:number = 0.1;
  private static MIN_WEB_ENTITY_SCORE:number = 0.1;
  private static MAX_RESULTS:number = 20;

  constructor() {
    super();
    this.validateConfig().then(() => {
      this.gv = new ImageAnnotatorClient({
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
    return this.readFile(inputFile).then((data: Buffer) => {

      let request = {
        image: {
          content: data
        },
        features: [
          {
            type: "LABEL_DETECTION",
            maxResults: GoogleVision.MAX_RESULTS
          }, 
          {
            type: "LANDMARK_DETECTION",
            maxResults: GoogleVision.MAX_RESULTS
          },
          {
            type: "LOGO_DETECTION",
            maxResults: GoogleVision.MAX_RESULTS
          },
          {
            type: "TEXT_DETECTION",
            maxResults: GoogleVision.MAX_RESULTS
          },
          {
            type: "WEB_DETECTION",
            maxResults: GoogleVision.MAX_RESULTS
          }
        ]
      };

      return this.gv.annotateImage(request).then((response) => {
        let sr = new ServiceResponse();

        if (!response || response.length != 1) {
          console.warn('Unexpected response from Google Vision');
          return sr;
        }
        
        let res = response[0];
        this.addLabels(res, sr);
        this.addLandmarks(res, sr);
        this.addLogos(res, sr);
        this.addTexts(res, sr);
        this.addWebDetection(res, sr);
        
        return sr;
      }).catch((error) => {
        throw this.getErrorObj(inputFile, error);
      });
    });
  }

  private getErrorObj(inputFile, error): Error {
    let errorVal: string = (typeof error === 'string') ? error : JSON.stringify(error, Object.getOwnPropertyNames(error), 2);
    return new Error('An error occurred while getting labels for "' + inputFile + '" from Google Vision: ' + errorVal);
  }

  private addLabels(response:any, sr:ServiceResponse):void {
    if (!response.labelAnnotations) {
      return;
    }

    response.labelAnnotations.forEach(label => {
      if (label.score >= GoogleVision.MIN_LABEL_SCORE) {
        sr.tags.push(label.description.toLowerCase());
      }
    });

    if (Config.googleTagsField && sr.tags.length > 0) {
      sr.metadata[Config.googleTagsField] = this.joinMultiValues(sr.tags);
    }
  }

  private addLandmarks(response:any, sr:ServiceResponse):void {
    let landmarks = response.landmarkAnnotations;

    if (!landmarks || landmarks.length == 0) {
      return;
    }

    let latLng = landmarks[0].locations[0].latLng;
    sr.metadata['gpsLatitude'] = latLng.latitude;
    sr.metadata['gpsLongitude'] = latLng.longitude;
    
    let locations = landmarks.reduce((newLocations, landmark) => {
      // Handle duplicate locations returned by Google
      if (!newLocations.includes(landmark.description)) {
        newLocations.push(landmark.description);
      }
      return newLocations;  
    }, []);
    
    sr.metadata['shownSublocation'] = locations.join(', ');
  }

  private addLogos(response, sr:ServiceResponse):void {
    let logos = response.logoAnnotations;

    if (!logos || logos.length == 0) {
      return;
    }

    let logoDescriptions:string[] = logos.map((logo) => {
      if (logo.score >= GoogleVision.MIN_LOGO_SCORE) {
        return logo.description;
      }
    });
    sr.metadata['cf_logos'] = this.joinMultiValues(logoDescriptions);
  }

  private addTexts(response, sr:ServiceResponse):void {
    let texts = response.textAnnotations;

    if (!texts || texts.length == 0) {
      return;
    }

    let extractedText = texts.map(text => text.description).join(' ');
    sr.metadata['cf_extractedText'] = extractedText;
  }

  private addWebDetection(response, sr:ServiceResponse):void {
    let webDetection = response.webDetection;
    
    if (!webDetection) {
      return;
    }

    this.addLinks('cf_fullMatchingImages', webDetection.fullMatchingImages, sr);
    this.addLinks('cf_pagesWithMatchingImages', webDetection.pagesWithMatchingImages, sr);
    this.addLinks('cf_partialMatchingImages', webDetection.partialMatchingImages, sr);

    let webEntities = webDetection.webEntities
    if (!webEntities || webEntities.length == 0) {
      return;
    }
    
    let webEntityTags = webEntities.map((entity) => {
      if (entity.score >= GoogleVision.MIN_WEB_ENTITY_SCORE) {
        return entity.description;
      }
    });
    sr.metadata['cf_webEntities'] = this.joinMultiValues(webEntityTags);
  }

  private addLinks(fieldName:string, links:any[], sr:ServiceResponse):void {
    if (!links || links.length == 0) {
      return;
    }
    let urls = links.map(link => link.url)
    sr.metadata[fieldName] = this.joinMultiValues(urls);
  }

  private replaceUnsafeChars(text:string):string {
    return text.replace(/;/g, ' ');
  }

  private joinMultiValues(values:string[]):string {
    return values.map(value => {
      if (value) {
        return this.replaceUnsafeChars(value);
      }
    }).join(';');
  }

}

