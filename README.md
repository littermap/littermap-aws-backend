Serverless cloud back-end for the [Litter Map](https://github.com/earthstewards/littermap) project.

## Architecture

- [Amazon API Gateway](https://aws.amazon.com/api-gateway/) API endpoints
- [AWS Lambda](https://aws.amazon.com/lambda/) serverless back-end logic
- [Amazon RDS](https://aws.amazon.com/rds/) database using [PostgreSQL](https://www.postgresql.org/) with [PostGIS](https://postgis.net/) to store global locations
- Stack deployment with [AWS CloudFormation](https://aws.amazon.com/cloudformation/)

## Requirements

- [aws-cli](https://aws.amazon.com/cli/) (for making AWS requests)
- [sam-cli](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) (1.29.0 or later) (for managing the serverless stack deployment)
- [jq](https://stedolan.github.io/jq/) (1.4 or later) command-line JSON processor (to parse JSON responses used by certain commands provided by the `manage` script)
- [yarn](https://yarnpkg.com/) (for nodejs dependencies)
- [docker](https://docs.docker.com/get-docker/) (for simulating the infrastructure to test functions locally)

## Software involved

- Lambda code uses [node.js](https://nodejs.org/about/) with [postgres](https://github.com/porsager/postgres/) library for database communication.

## Useful utilities

- [awslogs](https://github.com/jorgebastida/awslogs) for viewing logs
- [httpie](https://httpie.io/docs) for making HTTP requests

## How to deploy

First install the [requirements](#Requirements).

If you don't have an AWS account, [create one](https://aws.amazon.com/resources/create-account/).

Using your root AWS account, create a [new user](https://console.aws.amazon.com/iam/home#/users$new) with programmatic access to the AWS API. Make sure this user has membership in a group with `AdministratorAccess` privileges.

Select the created user on the [users](https://console.aws.amazon.com/iamv2/home#/users) page, and in the `Security credentials` tab choose `Create access key`. Select `Show` to see the secret access key. You will not have access to the key again using the web interface, so make sure to store it in a secure location. The [reference guide](https://docs.aws.amazon.com/general/latest/gr/aws-security-credentials.html) explains AWS security credentials and best practices in detail.

With this information on hand, configure the aws-cli utility with the access key and secret key along with the desired [deployment region](https://aws.amazon.com/about-aws/global-infrastructure/regions_az/) by running:

- `aws configure`

Your credentials will now be stored in a local file `~/.aws/credentials` and the AWS command line tools will now be able to execute commands on behalf of this account.

If this is a fresh clone of this source code repository, prepare the configuration files by running:

- `./prepare`

Prepare the stack template and function code for deployment:

- `sam build` ([what this does](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html))

Deploy the stack:

- `sam deploy -g` ([what this does](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html))

Enable outside network access to the database private subnet:

- `./manage rds-db-authorize-ingress`

Perform first-time initialization on the littermap database:

- `./manage rds-db-init`

This will enable PostGIS and create tables and users.

## Using the running service

The active URL for the deployed API can be viewed by running:

- `./manage list-api-urls`

Add a location:

- `echo '{"lat":22.31258,"lon":114.04127}' | http -v POST https://so3kybq7z6.execute-api.us-east-1.amazonaws.com/dev/add`

Retrieve a location:

- `http -v https://so3kybq7z6.execute-api.us-east-1.amazonaws.com/dev/id/1`

## Administration

Perform arbitrary queries on the database by running:

- `./manage rds-db-run <query> [<user>]` (user is: admin, writer, reader; default: admin)

For example, retrieve all the stored locations with:

- `./manage rds-db-run 'SELECT * FROM world.locations;' reader`

The database can be completely reset by running:

- `./manage rds-db-init`

To connect to the database and use it directly, first look up the database user passwords:

- `./manage list-lambdas | grep _PASSWORD | sort -u`

Get the host address with:

- `./manage list-rds-db-endpoints`

Then connect to the database: (must have [postgresql](https://www.postgresql.org/download/) installed to have the `psql` utility):

- `psql -U {litteradmin|writer|reader} -h {host} -p {port} -d littermap -W`

Type `\help` to get started.

## How to remove this service from the cloud

To take this service down, run:

- `./manage delete-stack` ([what this does](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-delete.html))

If that doesn't go smoothly, troubleshoot the issue or delete the stack in the [CloudFormation dashboard](https://console.aws.amazon.com/cloudformation/). Be aware that deleting or changing resources manually will result in [stack drift](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-stack-drift.html?icmpid=docs_cfn_console) and can [create difficulties](https://forums.aws.amazon.com/message.jspa?messageID=510944#512973) that need to be resolved in order to manage the stack.

## Development

After making any changes to the code, run:

- `sam build`

To deploy changes, run:

- `sam deploy`

### Modifying the serverless stack definition

After making adjustments to the stack definition in `template.yml`, check it for errors with:

- `sam validate`

If no errors are found, prepare the deployment files and then deploy the changes with:

- `sam build`
- `sam deploy`

After running `sam build`, the intermediate template is available at `.aws-sam/build/template.yaml`.

To change any parameter values before deployment, run `sam deploy -g`.

To learn more about the deployment process and options run:

- `sam build -h`
- `sam deploy -h`

## Development tips

- For quick iteration, bind a shell alias for `sam build && sam deploy`.

## Knowledge resources

### Serverless infrastructure with AWS

#### Videos

- [Brief introduction to AWS SAM](https://youtu.be/MipjLaTp5nA)
- [Detailed presentation on AWS SAM deployment](https://youtu.be/CIdUU6rNdk4)
- [Learn to build serverless applications](https://youtu.be/EBSdyoO3goc?list=PLkHoRc4IcLDrgUpLKT7NTJFTM46Gk0cjZ) (playlist)

#### Reading

- [Defining serverless applications as a single stack using AWS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [Understanding database options for your serverless web applications](https://awsfeed.com/whats-new/compute/understanding-database-options-for-your-serverless-web-applications)
- [What can be done with serverless lambda functions](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-features.html)
- [5 AWS mistakes you should avoid](https://cloudonaut.io/5-aws-mistakes-you-should-avoid/)
- [AWS Lambda execution context demystified](https://blog.ippon.tech/lambda-execution-context-demystified/)
- [Using AWS Web Application Firewall to protect your APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-control-access-aws-waf.html)
- [AWS fundamentals cheatsheet](https://github.com/agavrel/aws_fundamentals_cheatsheet)

### [Amazon RDS](https://aws.amazon.com/rds/) database

Amazon RDS is a scalable relational database service that is API-compatible with PostgreSQL, so techniques involving PostgreSQL generally apply.

- [What is Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html)
- [Builds a GIS server site on Amazon Web Services](https://enterprise.arcgis.com/en/server/10.4/cloud/amazon/build-arcgis-server-site-on-aws.htm)
- [Building a simple geodata service with Node, PostGIS, and Amazon RDS](https://blog.geomusings.com/2013/12/11/building-a-simple-geodata-service-with-node-and-amazon-rds/)
- [PostgreSQL on Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Overview of RDS database instance classes](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html)
- [AWS RDS best practices](https://www.cloudconformity.com/knowledge-base/aws/RDS/)
- [Cloning RDS instances for testing](https://blog.dmcquay.com/devops/2015/09/18/cloning-rds-instances-for-testing.html)
- [Using schemas in a PostgreSQL database](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [Using transaction blocks in PostgreSQL](https://www.postgresql.org/docs/current/sql-begin.html)
- [Connecting to Postgres using node-postgres](https://node-postgres.com/features/connecting)
- [Suggestions on what not to do with PostgreSQL](https://shabaam.co/postgresql-now-utc/)

### [DynamoDB](https://aws.amazon.com/dynamodb/) database

- Under consideration as an auxiliary database to be used for event logging

DynamoDB is a fast and flexible [NoSQL](https://www.mongodb.com/nosql-explained) database that is simple by design but difficult to master. Exceptionally optimal performance and extreme economy of scale can be achieved if used correctly.

- [A look at DynamoDB](https://cloudonaut.io/a-look-at-dynamodb/)
- [Amazon DynamoDB vs PostGIS](https://stackshare.io/stackups/amazon-dynamodb-vs-postgis)
- [Data modeling with document databases](https://db-engines.com/en/blog_post/51)
- [Querying on multiple attributes in Amazon DynamoDB](https://aws.amazon.com/blogs/database/querying-on-multiple-attributes-in-amazon-dynamodb/)
- [Choosing the right DynamoDB partition key](https://aws.amazon.com/blogs/database/choosing-the-right-dynamodb-partition-key/)
- [Implementing geohashing at scale in serverless web applications](https://aws.amazon.com/blogs/compute/implementing-geohashing-at-scale-in-serverless-web-applications/)

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
