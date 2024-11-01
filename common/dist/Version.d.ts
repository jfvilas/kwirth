/**
 *
 * @param version1 version to check against a specifi level
 * @param version2 level you want to compare to
 * @returns true if version1 version is higher than version2
 */
declare const versionGreatOrEqualThan: (version1: string, version2: string) => boolean;
declare const versionGreatThan: (version1: string, version2: string) => boolean;
export { versionGreatOrEqualThan, versionGreatThan };
