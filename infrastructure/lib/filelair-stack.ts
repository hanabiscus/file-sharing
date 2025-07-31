import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from "path";
import { Construct } from "constructs";
import { FrontendDeployment } from "./frontend-deployment";

export interface FileLairStackProps extends cdk.StackProps {
  githubOrg: string;
  githubRepo: string;
}

export class FileLairStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FileLairStackProps) {
    super(scope, id, props);

    // GitHub OIDC Provider
    const githubProvider = new iam.OpenIdConnectProvider(
      this,
      "GitHubOIDCProvider",
      {
        url: "https://token.actions.githubusercontent.com",
        clientIds: ["sts.amazonaws.com"],
        thumbprints: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
      }
    );

    // IAM Role for GitHub Actions
    const githubActionsRole = new iam.Role(this, "GitHubActionsDeployRole", {
      roleName: `GitHubActionsDeployRole-${props.githubRepo}`,
      assumedBy: new iam.FederatedPrincipal(
        githubProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub": `repo:${props.githubOrg}/${props.githubRepo}:*`,
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      description: "Role for GitHub Actions to deploy CDK",
    });

    // Create a custom policy with least privilege for CDK deployment
    const cdkDeployPolicy = new iam.PolicyDocument({
      statements: [
        // CloudFormation permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "cloudformation:CreateStack",
            "cloudformation:UpdateStack",
            "cloudformation:DeleteStack",
            "cloudformation:DescribeStacks",
            "cloudformation:DescribeStackEvents",
            "cloudformation:GetTemplate",
            "cloudformation:ValidateTemplate",
            "cloudformation:CreateChangeSet",
            "cloudformation:ExecuteChangeSet",
            "cloudformation:DeleteChangeSet",
            "cloudformation:DescribeChangeSet"
          ],
          resources: [
            `arn:aws:cloudformation:${this.region}:${this.account}:stack/${this.stackName}/*`,
            `arn:aws:cloudformation:${this.region}:${this.account}:stack/CDKToolkit/*`
          ]
        }),
        // S3 permissions for CDK assets and deployment
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "s3:CreateBucket",
            "s3:PutBucketPolicy",
            "s3:PutBucketPublicAccessBlock",
            "s3:PutBucketVersioning",
            "s3:PutBucketEncryption",
            "s3:PutBucketLifecycle",
            "s3:PutBucketCors",
            "s3:GetBucketLocation",
            "s3:GetBucketPolicy",
            "s3:ListBucket",
            "s3:PutObject",
            "s3:GetObject",
            "s3:DeleteObject",
            "s3:DeleteBucket"
          ],
          resources: [
            `arn:aws:s3:::filelair-*`,
            `arn:aws:s3:::filelair-*/*`,
            `arn:aws:s3:::cdk-*`,
            `arn:aws:s3:::cdk-*/*`
          ]
        }),
        // Lambda permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "lambda:CreateFunction",
            "lambda:UpdateFunctionCode",
            "lambda:UpdateFunctionConfiguration",
            "lambda:GetFunction",
            "lambda:DeleteFunction",
            "lambda:InvokeFunction",
            "lambda:AddPermission",
            "lambda:RemovePermission",
            "lambda:GetFunctionConfiguration",
            "lambda:TagResource",
            "lambda:UntagResource"
          ],
          resources: [
            `arn:aws:lambda:${this.region}:${this.account}:function:${this.stackName}-*`
          ]
        }),
        // DynamoDB permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "dynamodb:CreateTable",
            "dynamodb:UpdateTable",
            "dynamodb:DeleteTable",
            "dynamodb:DescribeTable",
            "dynamodb:UpdateTimeToLive",
            "dynamodb:TagResource",
            "dynamodb:UntagResource"
          ],
          resources: [
            `arn:aws:dynamodb:${this.region}:${this.account}:table/filelair`
          ]
        }),
        // API Gateway permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "apigateway:*"
          ],
          resources: [
            `arn:aws:apigateway:${this.region}::/restapis/*`,
            `arn:aws:apigateway:${this.region}::/tags/*`
          ]
        }),
        // CloudFront permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "cloudfront:CreateDistribution",
            "cloudfront:UpdateDistribution",
            "cloudfront:DeleteDistribution",
            "cloudfront:GetDistribution",
            "cloudfront:TagResource",
            "cloudfront:UntagResource",
            "cloudfront:CreateOriginAccessIdentity",
            "cloudfront:DeleteOriginAccessIdentity",
            "cloudfront:GetOriginAccessIdentity",
            "cloudfront:CreateResponseHeadersPolicy",
            "cloudfront:UpdateResponseHeadersPolicy",
            "cloudfront:DeleteResponseHeadersPolicy",
            "cloudfront:GetResponseHeadersPolicy"
          ],
          resources: ["*"]
        }),
        // EventBridge permissions
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "events:PutRule",
            "events:DeleteRule",
            "events:DescribeRule",
            "events:PutTargets",
            "events:RemoveTargets"
          ],
          resources: [
            `arn:aws:events:${this.region}:${this.account}:rule/${this.stackName}-*`
          ]
        }),
        // IAM permissions (restricted)
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "iam:CreateRole",
            "iam:AttachRolePolicy",
            "iam:PutRolePolicy",
            "iam:PassRole",
            "iam:DetachRolePolicy",
            "iam:DeleteRolePolicy",
            "iam:GetRole",
            "iam:GetRolePolicy",
            "iam:DeleteRole",
            "iam:TagRole",
            "iam:UntagRole",
            "iam:CreateOpenIDConnectProvider",
            "iam:GetOpenIDConnectProvider",
            "iam:DeleteOpenIDConnectProvider"
          ],
          resources: [
            `arn:aws:iam::${this.account}:role/${this.stackName}-*`,
            `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`
          ]
        }),
        // SSM Parameter Store permissions for reading parameters
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            "ssm:GetParameter",
            "ssm:GetParameters"
          ],
          resources: [
            `arn:aws:ssm:${this.region}:${this.account}:parameter/cdk-bootstrap/*`
          ]
        })
      ]
    });

    githubActionsRole.attachInlinePolicy(new iam.Policy(this, 'CDKDeployPolicy', {
      document: cdkDeployPolicy
    }));

    // Output the role ARN for GitHub Actions secret
    new cdk.CfnOutput(this, "GitHubActionsRoleArn", {
      value: githubActionsRole.roleArn,
      description:
        "ARN of the IAM role for GitHub Actions (set as AWS_ROLE_ARN secret)",
    });

    // S3 bucket for file storage
    const filesBucket = new s3.Bucket(this, "FilesBucket", {
      bucketName: `filelair-files`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: false,
      lifecycleRules: [
        {
          id: "delete-old-files",
          enabled: true,
          expiration: cdk.Duration.days(7), // Extra safety net
        },
      ],
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins: [
            "https://dk7lvukl3cd5w.cloudfront.net",
            "http://localhost:5173", // Development only
          ],
          allowedHeaders: [
            "Content-Type",
            "Content-Length",
            "Authorization",
            "x-amz-content-sha256",
            "x-amz-date",
          ],
          exposedHeaders: ["ETag"],
          maxAge: 3600,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB table for file metadata
    const filesTable = new dynamodb.Table(this, "FilesTable", {
      tableName: "filelair",
      partitionKey: {
        name: "shareId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expiresAt",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    // Grant permissions
    filesBucket.grantReadWrite(lambdaRole);
    filesTable.grantReadWriteData(lambdaRole);

    // Common Lambda environment
    const environment = {
      S3_BUCKET_NAME: filesBucket.bucketName,
      DYNAMODB_TABLE_NAME: filesTable.tableName,
    };

    // Lambda functions
    const uploadFunction = new nodejs.NodejsFunction(this, "UploadFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler",
      entry: path.join(__dirname, "../../backend/src/handlers/upload.ts"),
      environment,
      role: lambdaRole,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      bundling: {
        externalModules: ["@aws-sdk/*"],
        nodeModules: ["bcrypt"],
      },
    });

    const downloadFunction = new nodejs.NodejsFunction(
      this,
      "DownloadFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "handler",
        entry: path.join(__dirname, "../../backend/src/handlers/download.ts"),
        environment,
        role: lambdaRole,
        timeout: cdk.Duration.minutes(1),
        bundling: {
          externalModules: ["@aws-sdk/*"],
          nodeModules: ["bcrypt"],
        },
      }
    );

    const fileInfoFunction = new nodejs.NodejsFunction(
      this,
      "FileInfoFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "handler",
        entry: path.join(__dirname, "../../backend/src/handlers/fileInfo.ts"),
        environment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          externalModules: ["@aws-sdk/*"],
        },
      }
    );

    const cleanupFunction = new nodejs.NodejsFunction(this, "CleanupFunction", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "handler",
      entry: path.join(__dirname, "../../backend/src/handlers/cleanup.ts"),
      environment,
      role: lambdaRole,
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024,
      bundling: {
        externalModules: ["@aws-sdk/*"],
      },
    });

    // API Gateway
    const api = new apigateway.RestApi(this, "FileSharingApi", {
      restApiName: "fileLair API",
      defaultCorsPreflightOptions: {
        allowOrigins: [
          "http://localhost:5173", // Development
          "https://dk7lvukl3cd5w.cloudfront.net",
        ],
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
        ],
        allowCredentials: true,
      },
      binaryMediaTypes: ["multipart/form-data"],
    });

    // API routes
    const apiResource = api.root.addResource("api");

    const uploadResource = apiResource.addResource("upload");
    uploadResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(uploadFunction)
    );

    const fileResource = apiResource
      .addResource("file")
      .addResource("{shareId}");
    fileResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(fileInfoFunction)
    );

    const downloadResource = apiResource
      .addResource("download")
      .addResource("{shareId}");
    downloadResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(downloadFunction)
    );

    // EventBridge rule for cleanup
    const cleanupRule = new events.Rule(this, "CleanupRule", {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
    });
    cleanupRule.addTarget(new targets.LambdaFunction(cleanupFunction));

    // S3 bucket for frontend hosting
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      bucketName: `filelair-web`,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Security headers policy
    const responseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      "SecurityHeadersPolicy",
      {
        securityHeadersBehavior: {
          contentTypeOptions: { override: true },
          frameOptions: {
            frameOption: cloudfront.HeadersFrameOption.DENY,
            override: true,
          },
          referrerPolicy: {
            referrerPolicy:
              cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
            override: true,
          },
          strictTransportSecurity: {
            accessControlMaxAge: cdk.Duration.days(365),
            includeSubdomains: true,
            override: true,
          },
          xssProtection: {
            modeBlock: true,
            protection: true,
            override: true,
          },
          contentSecurityPolicy: {
            contentSecurityPolicy:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.amazonaws.com; frame-ancestors 'none';",
            override: true,
          },
        },
        customHeadersBehavior: {
          customHeaders: [
            {
              header: "Permissions-Policy",
              value: "camera=(), microphone=(), geolocation=()",
              override: true,
            },
          ],
        },
      }
    );

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: new origins.S3StaticWebsiteOrigin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: responseHeadersPolicy,
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: responseHeadersPolicy,
        },
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    // Deploy frontend files to S3
    new FrontendDeployment(this, "FrontendDeployment", {
      websiteBucket,
      distribution,
    });

    // Outputs
    new cdk.CfnOutput(this, "ApiUrl", {
      value: api.url,
      description: "API Gateway URL",
    });

    new cdk.CfnOutput(this, "WebsiteUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront distribution URL",
    });

    new cdk.CfnOutput(this, "WebsiteBucketName", {
      value: websiteBucket.bucketName,
      description: "S3 bucket for website hosting",
    });
  }
}
