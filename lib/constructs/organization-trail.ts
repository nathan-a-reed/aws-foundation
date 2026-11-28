import { Duration, RemovalPolicy, Validations } from 'aws-cdk-lib';
import { ReadWriteType, Trail } from 'aws-cdk-lib/aws-cloudtrail';
import { BlockPublicAccess, Bucket, BucketEncryption, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface OrganizationTrailProps {
  readonly organizationId: string;
  /** Fixed so that service control policies can protect the trail by name. */
  readonly trailName: string;
  readonly logRetentionDays: number;
}

/** CloudTrail trail recording management events from every account in the organization. */
export class OrganizationTrail extends Construct {
  public readonly bucket: Bucket;
  public readonly trail: Trail;

  constructor(scope: Construct, id: string, props: OrganizationTrailProps) {
    super(scope, id);

    this.bucket = new Bucket(this, 'LogBucket', {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      enforceSSL: true,
      lifecycleRules: [{ expiration: Duration.days(props.logRetentionDays) }],
      // Audit logs cannot be recreated, so they outlive the stack.
      removalPolicy: RemovalPolicy.RETAIN,
    });
    Validations.of(this.bucket).acknowledge({
      id: 'AwsSolutions::AwsSolutions-S1',
      reason:
        'Trail log bucket. Changes to the bucket are recorded by the trail itself, and a second bucket for access logs adds cost without a reader.',
    });

    this.trail = new Trail(this, 'Trail', {
      trailName: props.trailName,
      bucket: this.bucket,
      isOrganizationTrail: true,
      orgId: props.organizationId,
      isMultiRegionTrail: true,
      includeGlobalServiceEvents: true,
      enableFileValidation: true,
      managementEvents: ReadWriteType.ALL,
    });
  }
}
