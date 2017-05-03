import Promise = require('bluebird');
import { Config } from './config';
import { ApiManager } from './api-manager';
import { ElvisApi, AssetSearch, SearchResponse, HitElement } from './elvis-api/api';
import { FileUtils } from './file-utils';
import { GoogleVision } from './service/google-vision';
import { AwsRekognition } from './service/aws-rekognition';
import { Clarifai } from './service/clarifai';
import { ServiceResponse } from './service/service-response';

export class Recognizer {

  private api: ElvisApi = ApiManager.getApi();
  private deleteFile: Function = Promise.promisify(require('fs').unlink);

  private clarifai: Clarifai;
  private google: GoogleVision;
  private aws: AwsRekognition;

  constructor(public useClarifai: boolean = false, public useGoogle: boolean = false, public useAws: boolean = false) {
    if (!useClarifai && !useGoogle && !useAws) {
      throw new Error('Specify at least one recognition service');
    }
    if (useClarifai) {
      this.clarifai = new Clarifai();
    }
    if (useGoogle) {
      this.google = new GoogleVision();
    }
    if (useAws) {
      this.aws = new AwsRekognition();
    }
  }

  public recognize(assetId: string): void {

    console.info('Image recognition started for asset: ' + assetId);

    let filePath: string;

    // 1. Download the asset preview
    this.downloadAsset(assetId).then((path: string) => {
      // 2. Send image to all configured AI image recognition services
      filePath = path;
      let services = [];
      if (this.useClarifai) {
        services.push(this.clarifai.detect(filePath));
      }
      if (this.useGoogle) {
        services.push(this.google.detect(filePath));
      }
      if (this.useAws) {
        services.push(this.aws.detect(filePath));
      }
      return Promise.all(services);
    }).then((serviceResponses: ServiceResponse[]) => {
      // 3. Delete the image, we no longer need it 
      this.deleteFile(filePath).catch((error: NodeJS.ErrnoException) => {
        console.error('Unable to remove temporary file: ' + error);
      });

      // 4. Combine results from the services and update metadata in Elvis
      let metadata: any = {};
      let tags: string[] = [];
      serviceResponses.forEach((serviceResponse: ServiceResponse) => {
        // Merge metadata values, note: this is quite a blunt merge, 
        // this only works because the cloud services don't use identical metadata fields
        metadata = (Object.assign(metadata, serviceResponse.metadata));
        tags = tags.concat(serviceResponse.tags);
      });
      metadata[Config.elvisTagsField] = tags.join(',');
      return this.api.update(assetId, JSON.stringify(metadata), undefined, 'filename');
    }).then((hit: HitElement) => {
      // 5. We're done!
      console.info('Image recognition finshed for asset: ' + assetId + ' (' + hit.metadata['filename'] + ')');
    }).catch((error: any) => {
      console.error('Image recognition failed for asset: ' + assetId + '. Error details:\n' + error.stack);
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
        throw new Error('Asset ' + assetId + ' doesn\'t have a preview, unable to extract labels.');
      }
      return FileUtils.downloadPreview(hit, Config.tempDir);
    });
  }
}
