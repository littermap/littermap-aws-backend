Serverless cloud back-end for the [Litter Map](https://github.com/earthstewards/littermap) front-end.

## Architecture

- [Amazon API Gateway](https://aws.amazon.com/api-gateway/) API endpoints
- [AWS Lambda](https://aws.amazon.com/lambda/) back-end logic
- Deployment with [AWS CloudFormation](https://aws.amazon.com/cloudformation/)

## Requirements

- [aws-cli](https://aws.amazon.com/cli/)
- [sam-cli](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) (1.29.0 or later)
- [jq](https://stedolan.github.io/jq/) command-line JSON processor (for certain commands provided by the `manage` script)

## How to deploy

First install the [requirements](#Requirements).

If this is a fresh clone of this source code repository, prepare the configuration files by running:

- `./prepare`

Configure the aws-cli utility with your AWS [account information](https://console.aws.amazon.com/iam/) and [deployment region](https://aws.amazon.com/about-aws/global-infrastructure/regions_az/) by running:

- `aws configure`

Package the lambda for deployment:

- `./manage build-lambda spot`

Prepare the stack for deployment:

- `sam build` ([what this does](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html))

Deploy the stack:

- `sam deploy --guided` ([what this does](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html))

If you would like an introduction to how this kind of deployment works, watch this excellent [introduction video](https://youtu.be/MipjLaTp5nA).

## How to undeploy this service from the cloud:

To take this service down, run:

- `sam delete --stack-name littermap-backend` ([what this does](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-delete.html))

## Development

To deploy a new version of the lambda function, run:

- `./manage build-lambda spot`
- `sam deploy`

To see which API endpoints are deployed:

- `./manage list-api-urls`

## Knowledge resources

### Application architecture with AWS

- [Understanding database options for your serverless web applications](https://awsfeed.com/whats-new/compute/understanding-database-options-for-your-serverless-web-applications)
- [What can be done with serverless lambda functions](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-features.html)
- [5 AWS mistakes you should avoid](https://cloudonaut.io/5-aws-mistakes-you-should-avoid/)
- [AWS Lambda execution context demystified](https://blog.ippon.tech/lambda-execution-context-demystified/)
- [Using AWS Web Application Firewall to protect your APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-control-access-aws-waf.html)

### Database candidate: [DynamoDB](https://aws.amazon.com/dynamodb/)

DynamoDB is a fast and flexible [NoSQL](https://www.mongodb.com/nosql-explained) database that is simple by design but difficult to master. Exceptionally optimal performance and extreme economy of scale can be achieved if used correctly.

- [A look at DynamoDB](https://cloudonaut.io/a-look-at-dynamodb/)
- [Amazon DynamoDB vs PostGIS](https://stackshare.io/stackups/amazon-dynamodb-vs-postgis)
- [Data modeling with document databases](https://db-engines.com/en/blog_post/51)
- [Querying on multiple attributes in Amazon DynamoDB](https://aws.amazon.com/blogs/database/querying-on-multiple-attributes-in-amazon-dynamodb/)
- [Choosing the right DynamoDB partition key](https://aws.amazon.com/blogs/database/choosing-the-right-dynamodb-partition-key/)
- [Implementing geohashing at scale in serverless web applications](https://aws.amazon.com/blogs/compute/implementing-geohashing-at-scale-in-serverless-web-applications/)

### Database candidate: [Amazon RDS](https://aws.amazon.com/rds/)

Amazon RDS is a scalable relational database service that is API-compatible with PostgreSQL, so techniques involving PostgreSQL generally apply.

- [What is Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html)
- [Builds a GIS server site on Amazon Web Services](https://enterprise.arcgis.com/en/server/10.4/cloud/amazon/build-arcgis-server-site-on-aws.htm)
- [Building a simple geodata service with Node, PostGIS, and Amazon RDS](https://blog.geomusings.com/2013/12/11/building-a-simple-geodata-service-with-node-and-amazon-rds/)

### Technical resources

- [Create a Lambda funciton with AWS command line interface](https://medium.com/swlh/create-a-lambda-function-with-aws-command-line-interface-55e5f2af92e1)
- [AWS Lambda python demo using AWS CLI](https://medium.com/@schogini/aws-lambda-python-demo-using-aws-cli-5b088270784e)
- [AWS APIGateway and Lambda - a GET method CLI demo](https://medium.com/@schogini/aws-apigateway-and-lambda-a-get-mehod-cli-demo-8a05e82df275)
- [AWS API gateway permission to invoke Lambda functions](https://medium.com/@jun711.g/aws-api-gateway-invoke-lambda-function-permission-6c6834f14b61)

### Reference

- [AWS terminology glossary](https://docs.aws.amazon.com/general/latest/gr/glos-chap.html)

## Quick links

- [CloudFormation management console](https://console.aws.amazon.com/cloudformation/)
- [Your Lambda functions](https://console.aws.amazon.com/lambda/home#/functions)
- [Your API gateways](https://console.aws.amazon.com/apigateway/main/apis)
- [CloudWatch logs](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups)
- [Identity and Access Management](https://console.aws.amazon.com/iam/)
