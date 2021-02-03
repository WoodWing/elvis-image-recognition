import url = require('url');
import fs = require('fs');
import path = require('path');
import { ApiManager } from '../elvis-api/api-manager';
import Promise = require('bluebird');
import lvs = require('../elvis-api/api');
import { v4 as uuidV4 } from 'uuid';

export class FileUtils {

  /**
   * Download a thumbnail from Elvis.
   * On success, returns a Promise with the destination file path.
   * 
   * @param hit Hit to download
   * @param destinationFolder Target folder where the file is downloaded
   */
  public static downloadThumbnail(hit: lvs.HitElement, destinationFolder: string): Promise<string> {
    return this.download(DownloadKind.Thumbnail, hit, destinationFolder);
  }

  /**
   * Download a preview from Elvis.
   * On success, returns a Promise with the destination file path.
   * 
   * @param hit Hit to download
   * @param destinationFolder Target folder where the file is downloaded
   */
  public static downloadPreview(hit: lvs.HitElement, destinationFolder: string): Promise<string> {
    return this.download(DownloadKind.Preview, hit, destinationFolder);
  }

  /**
   * Download the original file from Elvis.
   * On success, returns a Promise with the destination file path.
   * 
   * @param hit Hit to download
   * @param destinationFolder Target folder where the file is downloaded
   */
  public static downloadOriginal(hit: lvs.HitElement, destinationFolder: string): Promise<string> {
    return this.download(DownloadKind.Original, hit, destinationFolder);
  }

  /**
   * Download a thumbnail, preview or original file from Elvis to a specified destination folder. 
   * On success, returns a Promise with the destination file path.
   * 
   * @param kind What to download: thumbnail, preview or original
   * @param hit Hit to download
   * @param destinationFolder Target folder where the file is downloaded
   */
  public static download(kind: DownloadKind, hit: lvs.HitElement, destinationFolder: string): Promise<string> {
    if (!hit) throw new Error('hit is a required parameter');
    if (!destinationFolder) throw new Error('destinationFolder is a required parameter');

    let fileUrl: string;
    switch (kind) {
      case DownloadKind.Thumbnail:
        fileUrl = hit.thumbnailUrl;
        break;
      case DownloadKind.Preview:
        fileUrl = hit.previewUrl;
        break;
      case DownloadKind.Original:
        fileUrl = hit.originalUrl;
        break;
      default:
        throw new Error('Unsupported kind specified: ' + kind);
    }
    if (!fileUrl) {
      throw new Error('No ' + DownloadKind[kind] + ' URL available for hit: ' + hit.id);
    }

    let filename: string = path.basename(url.parse(fileUrl).pathname);
    let ext: string = path.extname(filename);
    let baseFilename: string = path.basename(filename, ext);
    let tempFilename: string = baseFilename + '_' + uuidV4() + ext;
    let destination: string = path.join(destinationFolder, tempFilename);

    return this.downloadFile(hit.previewUrl, destination);
  }

  /**
   * Download an Elvis URL.
   * On success, returns a Promise with the destination file path.
   * 
   *  @param url URL to download
   * @param destination Destination folder
   */
  private static downloadFile(url: string, destination: string): Promise<string> {
    return this.createDestinationDirectory(destination).then(() => {
      return ApiManager.getApi().elvisRequest.requestFile(url, destination);
    });
  }

  /**
   * Create a folder for a given file if it doesn't exists
   * 
   * @param file 
   */
  private static createDestinationDirectory(file: string): Promise<string> {
    let dir: string = require('path').dirname(file);
    return new Promise<string>((resolve, reject) => {
      fs.mkdir(dir, error => {
        if (!error || (error && error.code === 'EEXIST')) {
          resolve(dir);
        }
        else {
          reject(error);
        }
      });
    });
  }

}

export enum DownloadKind {
  Thumbnail,
  Preview,
  Original
}