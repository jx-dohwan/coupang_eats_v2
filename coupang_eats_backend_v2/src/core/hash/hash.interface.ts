export interface IHashService {
  hash(data: string): Promise<string>;
  compare(data: string, hash: string): Promise<boolean>;
}
export const HASH_SERVICE = 'HASH_SERVICE';
