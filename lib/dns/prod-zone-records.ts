import type { DnsRecord } from '../constructs/account-dns-zone.ts';

/**
 * Records of the `nathanreed.dev` zone, copied from the zone in the
 * management account, without its NS and SOA records.
 */
export const prodZoneRecords: readonly DnsRecord[] = [];
