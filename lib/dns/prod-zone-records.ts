import type { DnsRecord } from '../constructs/account-dns-zone.ts';

export interface ProdZoneValues {
  /** Address of `server.nathanreed.dev`, from `SERVER_IP_ADDRESS`. */
  readonly serverIpAddress: string;
}

/**
 * Records of the `nathanreed.dev` zone, copied from the zone in the
 * management account, without its NS and SOA records. Values that are
 * personal data come from deploy-time variables.
 */
export function prodZoneRecords(values: ProdZoneValues): DnsRecord[] {
  return [
    {
      type: 'MX',
      name: '',
      ttlSeconds: 300,
      values: [{ priority: 1, hostName: 'smtp.google.com.' }],
    },
    {
      type: 'TXT',
      name: '',
      ttlSeconds: 300,
      values: ['google-site-verification=wd_7_jGZ1Iykqj-mcaxFGumrE5l42kGhFCctRXZFzMc'],
    },
    {
      // ACM DNS validation, so the certificate that uses it keeps renewing.
      type: 'CNAME',
      name: '_55498b75d58d5e0f1b76d605099fc1cc',
      ttlSeconds: 500,
      value: '_251e74c9a7be8ac0a2f9bf9e33dd6855.xlfgrmvvlj.acm-validations.aws.',
    },
    {
      type: 'A',
      name: 'server',
      ttlSeconds: 300,
      values: [values.serverIpAddress],
    },
  ];
}
