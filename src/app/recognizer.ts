import Promise = require('bluebird');
import { Config } from '../config';
import { ApiManager } from '../elvis-api/api-manager';
import { ElvisApi, AssetSearch, SearchResponse, HitElement } from '../elvis-api/api';
import { FileUtils } from './file-utils';
import { Utils } from './utils';
import { GoogleVision } from './service/google-vision';
import { AwsRekognition } from './service/aws-rekognition';
import { Clarifai } from './service/clarifai';
import { ServiceResponse } from './service/service-response';
import { GoogleTranslate } from './service/google-translate';
import { Emrays } from './service/emrays';

export class Recognizer {

  private api: ElvisApi = ApiManager.getApi();
  private deleteFile: Function = Promise.promisify(require('fs').unlink);

  private clarifai: Clarifai;
  private googleVision: GoogleVision;
  private aws: AwsRekognition;
  private googleTranslate: GoogleTranslate;
  private emrays: Emrays;

  constructor(public useClarifai: boolean = false, public useGoogle: boolean = false, public useAws: boolean = false, public useEmrays: boolean = false, public translate: boolean = false) {
    if (!useClarifai && !useGoogle && !useAws) {
      throw new Error('Specify at least one recognition service');
    }
    if (useClarifai) {
      this.clarifai = new Clarifai();
    }
    if (useGoogle) {
      this.googleVision = new GoogleVision();
    }
    if (useAws) {
      this.aws = new AwsRekognition();
    }
    if (useEmrays) {
      this.emrays = new Emrays();
    }
    if (translate) {
      this.googleTranslate = new GoogleTranslate();
    }
  }

  public recognize(assetId: string, models: string[] = null, assetPath: string = null): Promise<HitElement> {

    console.info('Image recognition started for asset: ' + assetId);

    let filePath: string;
    let metadata: any = {};

    // 1. Download the asset preview
    return this.downloadAsset(assetId).then((path: string) => {
      // 2. Send image to all configured AI image recognition services
      filePath = path;
      let services = [];
      if (this.useClarifai) {
        services.push(this.clarifai.detect(filePath, models, assetPath));
      }
      if (this.useGoogle) {
        services.push(this.googleVision.detect(filePath));
      }
      if (this.useAws) {
        services.push(this.aws.detect(filePath));
      }
      if (this.useEmrays) {
        services.push(this.emrays.detect(filePath));
      }
      return Promise.all(services);
    }).then((serviceResponses: ServiceResponse[]) => {
      // 3. Delete the image, we no longer need it 
      this.deleteFile(filePath).catch((error: NodeJS.ErrnoException) => {
        console.error('Unable to remove temporary file: ' + error);
      });

      // 4. Combine results from the services
      let tags: string[] = [];
      serviceResponses.forEach((serviceResponse: ServiceResponse) => {
        // Merge metadata values, note: this is quite a blunt merge, 
        // this only works because the cloud services don't use identical metadata fields
        metadata = (Object.assign(metadata, serviceResponse.metadata));
        tags = Utils.mergeArrays(tags, serviceResponse.tags);
      });
      let tagString: string = tags.join(';');
      metadata[Config.elvisTagsField] = tagString;
      // 5. Translate (if configured)
      if (this.translate) {
        return this.googleTranslate.translate(tagString).then((translatedMetadata: any) => {
          metadata = (Object.assign(metadata, translatedMetadata));
        });
      }
    }).then(() => {
      // 6. Update metadata
      metadata[Config.aiMetadataModifiedField] = new Date().getTime();
      return this.api.update(assetId, JSON.stringify(metadata), undefined, 'filename');
    }).then((hit: HitElement) => {
      // 7. We're done!
      console.info('Image recognition finished for asset: ' + assetId + ' (' + hit.metadata['filename'] + ')');
      return hit;
    }).catch((error: any) => {
      if (error instanceof NoPreviewError) {
        // We're not logging this error as it's triggered by desktop client uploads
        // console.info(error.message);
      }
      else {
        console.error('Image recognition failed for asset: ' + assetId + '. Error details:\n' + error.stack);
      }
    });
  }

  public recognizeFile(filePath: string, models: string[] = null, assetPath: string = null): Promise<ServiceResponse> {
    let services = [];
    if (this.useClarifai) {
      services.push(this.clarifai.detect(filePath, models, assetPath));
    }
    if (this.useGoogle) {
      services.push(this.googleVision.detect(filePath));
    }
    if (this.useAws) {
      services.push(this.aws.detect(filePath));
    }
    return Promise.all(services).then((serviceResponses: ServiceResponse[]) => {
      // Combine results from the services
      let tags: string[] = [];
      let sr = new ServiceResponse();
      serviceResponses.forEach((serviceResponse: ServiceResponse) => {
        // Merge metadata values, note: this is quite a blunt merge, 
        // this only works because the cloud services don't use identical metadata fields
        sr.metadata = (Object.assign(sr.metadata, serviceResponse.metadata));
        sr.tags = Utils.mergeArrays(sr.tags, serviceResponse.tags);
      });
      let tagString: string = tags.join(',');
      sr.metadata[Config.elvisTagsField] = tagString;
      return Promise.resolve(sr);
    }).catch((error) => {
      return Promise.reject(new Error('Image recognition failed for file: ' + filePath + '. Error details:\n' + error.stack));
    });
  }

  private downloadAsset(assetId: string): Promise<string> {
    let query: string = 'id:' + assetId;
    let search: AssetSearch = {
      query: {
        QueryStringQuery: {
          queryString: query
        }
      },
      returnPendingImports: true
    };
    return this.api.searchPost(search).then((sr: SearchResponse) => {
      if (sr.totalHits !== 1) {
        // Should only happen when the asset is not available any more for some reason (deleted / incorrect permission setup)
        throw new Error('Unexpected number of assets retrieved (' + sr.totalHits + '). This query should return 1 asset: ' + query
          + '\nThis error can occur when the asset is no longer available in Elvis or when the configured Elvis user does not have permission to access the given asset.');
      }
      let hit: HitElement = sr.hits[0];
      if (!hit.previewUrl) {
        throw new NoPreviewError('Asset ' + assetId + ' doesn\'t have a preview, unable to extract labels.', assetId);
      }
      return FileUtils.downloadPreview(hit, Config.tempDir);
    });
  }
}

class NoPreviewError extends Error {
  constructor(public message = '', public assetId: string = '') {
    super(message);
  }
}
