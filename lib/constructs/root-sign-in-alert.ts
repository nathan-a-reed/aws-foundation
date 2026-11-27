import { Validations } from 'aws-cdk-lib';
import { Rule } from 'aws-cdk-lib/aws-events';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface RootSignInAlertProps {
  readonly alertEmail: string;
}

/**
 * Emails when the root user signs in to the console of this account. Console
 * sign-in events reach EventBridge through CloudTrail, so a trail must exist.
 */
export class RootSignInAlert extends Construct {
  public readonly topic: Topic;
  public readonly rule: Rule;

  constructor(scope: Construct, id: string, props: RootSignInAlertProps) {
    super(scope, id);

    this.topic = new Topic(this, 'Topic', {
      displayName: 'Root sign-in alert',
      enforceSSL: true,
    });
    Validations.of(this.topic).acknowledge({
      id: 'AwsSolutions::AwsSolutions-SNS2',
      reason:
        'The message holds only sign-in metadata. The AWS managed SNS key does not let EventBridge publish, and a customer managed key costs more than the alert is worth.',
    });
    this.topic.addSubscription(new EmailSubscription(props.alertEmail));

    this.rule = new Rule(this, 'Rule', {
      description: 'Root user console sign-in',
      eventPattern: {
        source: ['aws.signin'],
        detailType: ['AWS Console Sign In via CloudTrail'],
        detail: { userIdentity: { type: ['Root'] } },
      },
      targets: [new SnsTopic(this.topic)],
    });
  }
}
