export class Utils {
  public static mergeArrays(...arr) {
    return Array.from(new Set([].concat(...arr)));
  }
}