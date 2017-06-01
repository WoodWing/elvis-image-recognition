import * as lvs from './api';

/**
 * Test class for all Elvis API features
 */
class ApiTest {

  private api: lvs.ElvisApi;

  constructor() {
    // Prep API
    this.api = new lvs.ElvisApi('importmodule', 'changemenow', 'http://localhost:8080');

    // Run tests
    this.advancedSearchTest1();
    this.advancedSearchTest2();
    this.simpleSearchTest();
  }

  public advancedSearchTest1(): void {
    let search: lvs.AssetSearch = new lvs.AssetSearch();
    search.query = new lvs.Query();
    search.query.QueryStringQuery = new lvs.QueryStringQuery();
    search.query.QueryStringQuery.queryString = 'audi';
    let facet = new lvs.Facet();
    facet.field = 'tags';
    facet.selection = new lvs.FacetSelection();
    facet.selection.values = ['small'];
    search.facets = { 'tags': facet };

    this.api.searchPost(search).then((sr: lvs.SearchResponse) => {
      console.log('Advanced search 1, hits found: ' + sr.totalHits);
      sr.hits.forEach(hit => {
        console.log('Hit: filename:' + hit.metadata['filename'] + '; assetCreated:' + hit.metadata['assetCreated'].formatted);
      });
    }).catch((error: any) => {
      console.log(error);
    });
  }

  public advancedSearchTest2(): void {

    let search: lvs.AssetSearch = {
      query: {
        QueryStringQuery: {
          queryString: 'audi'
        }
      },
      facets: {
        tags: {
          field: 'tags',
          expandSelection: false,
          minOccurs: 0,
          maxOccurs: 0,
          searchOrder: 'asc',
          resultOrder: 'asc',
          selection: {
            values: ['small'],
            notValues: [],
            operation: 'AND'
          }
        }
      }
    };

    this.api.searchPost(search).then((sr: lvs.SearchResponse) => {
      console.log('Advanced search 2, hits found: ' + sr.totalHits);
      sr.hits.forEach(hit => {
        console.log('Hit: filename:' + hit.metadata['filename'] + '; assetCreated:' + hit.metadata['assetCreated'].formatted);
      });
    }).catch((error: any) => {
      console.log(error);
    });
  }

  public simpleSearchTest(): void {
    let query = 'audi AND tags:small';
    this.api.searchGet(query).then((sr: lvs.SearchResponse) => {
      console.log('Simple search, hits found: ' + sr.totalHits);
      sr.hits.forEach(hit => {
        console.log('Hit: filename:' + hit.metadata['filename'] + '; assetCreated:' + hit.metadata['assetCreated'].formatted);
      });
    }).catch((error: any) => {
      console.log(error);
    });
  }

}
export = ApiTest;