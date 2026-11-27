import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ServiceControlPolicy } from './service-control-policy.ts';

export interface WorkloadGuardrailsProps {
  /** Organizational units the guardrails apply to. */
  readonly targetIds: readonly string[];
  readonly allowedRegion: string;
  readonly organizationTrailName: string;
}

/**
 * Global services exempt from the Region restriction, from the AWS example
 * "Deny access to AWS based on the requested AWS Region"
 * (github.com/aws-samples/service-control-policy-examples,
 * Region-controls/Deny-access-to-AWS-based-on-the-requested-AWS-region.json).
 */
export const globalServiceActions = [
  'a4b:*',
  'acm:*',
  'aws-marketplace-management:*',
  'aws-marketplace:*',
  'aws-portal:*',
  'budgets:*',
  'ce:*',
  'chime:*',
  'cloudfront:*',
  'config:*',
  'cur:*',
  'directconnect:*',
  'ec2:DescribeRegions',
  'ec2:DescribeTransitGateways',
  'ec2:DescribeVpnGateways',
  'fms:*',
  'globalaccelerator:*',
  'health:*',
  'iam:*',
  'importexport:*',
  'kms:*',
  'mobileanalytics:*',
  'networkmanager:*',
  'organizations:*',
  'pricing:*',
  'route53:*',
  'route53domains:*',
  'route53-recovery-cluster:*',
  'route53-recovery-control-config:*',
  'route53-recovery-readiness:*',
  's3:GetAccountPublic*',
  's3:ListAllMyBuckets',
  's3:ListMultiRegionAccessPoints',
  's3:PutAccountPublic*',
  'shield:*',
  'sts:*',
  'support:*',
  'trustedadvisor:*',
  'waf-regional:*',
  'waf:*',
  'wafv2:*',
  'wellarchitected:*',
];

/** Service control policies for the workload accounts. */
export class WorkloadGuardrails extends Construct {
  public readonly baseline: ServiceControlPolicy;
  public readonly regionRestriction: ServiceControlPolicy;

  constructor(scope: Construct, id: string, props: WorkloadGuardrailsProps) {
    super(scope, id);

    this.baseline = new ServiceControlPolicy(this, 'Baseline', {
      policyName: 'workloads-baseline',
      description:
        'Deny leaving the organization, changing the organization trail, and root user actions.',
      targetIds: props.targetIds,
      statements: [
        new PolicyStatement({
          sid: 'DenyLeavingOrganization',
          effect: Effect.DENY,
          actions: ['organizations:LeaveOrganization'],
          resources: ['*'],
        }),
        new PolicyStatement({
          sid: 'ProtectOrganizationTrail',
          effect: Effect.DENY,
          actions: [
            'cloudtrail:CreateTrail',
            'cloudtrail:DeleteTrail',
            'cloudtrail:PutEventSelectors',
            'cloudtrail:StopLogging',
            'cloudtrail:UpdateTrail',
          ],
          resources: [`arn:aws:cloudtrail:*:*:trail/${props.organizationTrailName}`],
        }),
        // Sessions from centralized root access (sts:AssumeRoot) carry
        // aws:AssumedRoot and stay allowed, so privileged tasks still work.
        new PolicyStatement({
          sid: 'DenyRootUser',
          effect: Effect.DENY,
          actions: ['*'],
          resources: ['*'],
          conditions: {
            ArnLike: { 'aws:PrincipalArn': ['arn:aws:iam::*:root'] },
            Null: { 'aws:AssumedRoot': 'true' },
          },
        }),
      ],
    });

    this.regionRestriction = new ServiceControlPolicy(this, 'RegionRestriction', {
      policyName: 'workloads-region-restriction',
      description: `Deny actions outside ${props.allowedRegion}, except global services.`,
      targetIds: props.targetIds,
      statements: [
        new PolicyStatement({
          sid: 'DenyOutsideAllowedRegion',
          effect: Effect.DENY,
          notActions: globalServiceActions,
          resources: ['*'],
          conditions: {
            StringNotEquals: { 'aws:RequestedRegion': [props.allowedRegion] },
          },
        }),
      ],
    });
  }
}
