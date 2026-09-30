import type { NearEarthObject } from "../../models/neo";
import type { ObjectId } from "../../models/trajectory";
import { HorizonsError } from "./parser";
export interface HorizonsTarget {
  id: ObjectId;
  name: string;
  command: string;
  identity: RegExp;
}
/** NASA IDs are provider keys, not Horizons commands. Extract only recognized
 * designations or permanent asteroid numbers from the canonical NASA name. */
export function resolveHorizonsTarget(neo: NearEarthObject): HorizonsTarget {
  const designation =
    neo.name.match(/\(((?:18|19|20)\d{2} [A-Z]{2}\d*)\)/)?.[1] ??
    neo.name.match(/^((?:18|19|20)\d{2} [A-Z]{2}\d*)$/)?.[1];
  if (designation) {
    return {
      id: neo.id,
      name: neo.name,
      command: `DES=${designation};`,
      identity: new RegExp(`(?:^|\\()${designation}(?:\\)|\\s*\\{)`),
    };
  }
  const number = neo.name.match(/^([1-9]\d*)\s+[A-Za-z][A-Za-z -]*$/)?.[1];
  if (number)
    return {
      id: neo.id,
      name: neo.name,
      command: `${number};`,
      identity: new RegExp(`^${number}\\s`),
    };
  throw new HorizonsError(
    `Cannot resolve a unique Horizons designation for ${neo.name}. This object can remain in the discovery list.`,
  );
}
