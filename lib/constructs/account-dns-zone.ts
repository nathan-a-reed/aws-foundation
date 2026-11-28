import { CfnOutput, Duration, Fn, RemovalPolicy } from 'aws-cdk-lib';
import { CnameRecord, MxRecord, PublicHostedZone, TxtRecord } from 'aws-cdk-lib/aws-route53';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

interface RecordBase {
  /** Name relative to the zone; an empty string is the zone apex. */
  readonly name: string;
  readonly ttlSeconds: number;
}

export interface MxDnsRecord extends RecordBase {
  readonly type: 'MX';
  readonly values: readonly { readonly priority: number; readonly hostName: string }[];
}

export interface TxtDnsRecord extends RecordBase {
  readonly type: 'TXT';
  /** Unquoted values. Values over 255 characters are split into 255-character strings. */
  readonly values: readonly string[];
}

export interface CnameDnsRecord extends RecordBase {
  readonly type: 'CNAME';
  readonly value: string;
}

/** One record set: every value for a name and type. */
export type DnsRecord = MxDnsRecord | TxtDnsRecord | CnameDnsRecord;

export interface AccountDnsZoneProps {
  readonly zoneName: string;
  readonly records: readonly DnsRecord[];
  /** Keep the zone if the stack is deleted, so its name servers stay valid. */
  readonly retain: boolean;
}

export const zoneNameParameterName = '/foundation/dns/zone-name';
export const zoneIdParameterName = '/foundation/dns/zone-id';

/** `_dmarc` becomes `DmarcTxt`, the apex MX record `ApexMx`. */
function recordId(record: DnsRecord): string {
  const parts = record.name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const name =
    parts.length === 0
      ? 'Apex'
      : parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  const type = record.type.charAt(0) + record.type.slice(1).toLowerCase();
  return `${name}${type}`;
}

/**
 * The public hosted zone of a workload account, its records, and the
 * `/foundation/dns/` parameters that applications read.
 */
export class AccountDnsZone extends Construct {
  public readonly zone: PublicHostedZone;

  constructor(scope: Construct, id: string, props: AccountDnsZoneProps) {
    super(scope, id);

    this.zone = new PublicHostedZone(this, 'Zone', { zoneName: props.zoneName });
    this.zone.applyRemovalPolicy(props.retain ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY);

    for (const record of props.records) {
      const common = {
        zone: this.zone,
        recordName: record.name === '' ? undefined : record.name,
        ttl: Duration.seconds(record.ttlSeconds),
      };
      const recordConstructId = recordId(record);
      switch (record.type) {
        case 'MX':
          new MxRecord(this, recordConstructId, { ...common, values: [...record.values] });
          break;
        case 'TXT':
          new TxtRecord(this, recordConstructId, { ...common, values: [...record.values] });
          break;
        case 'CNAME':
          new CnameRecord(this, recordConstructId, { ...common, domainName: record.value });
          break;
      }
    }

    new StringParameter(this, 'ZoneNameParameter', {
      parameterName: zoneNameParameterName,
      description: 'Name of the account hosted zone',
      stringValue: props.zoneName,
    });
    new StringParameter(this, 'ZoneIdParameter', {
      parameterName: zoneIdParameterName,
      description: 'ID of the account hosted zone',
      stringValue: this.zone.hostedZoneId,
    });

    new CfnOutput(this, 'NameServers', {
      description: `Name servers of the ${props.zoneName} hosted zone`,
      value: Fn.join(',', this.zone.hostedZoneNameServers ?? []),
    });
  }
}
