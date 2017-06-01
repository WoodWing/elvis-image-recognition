import { Config } from '../config';
import { ElvisApi } from '../elvis-api/api';

/**
 * Singleton class that ensures only one Elvis API session is used.
 */
export class ApiManager {

  private static instance: ApiManager;

  public api: ElvisApi;

  /**
   * Create an Elvis API instance
   */
  public static getApi(): ElvisApi {
    if (!this.instance) {
      this.instance = new this();
    }
    return this.instance.api;
  }

  private constructor() {
    // Log into Elvis
    this.api = new ElvisApi(Config.elvisUsername, Config.elvisPassword, Config.elvisUrl);
  }

}