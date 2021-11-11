Cloud native back-end for the [Litter Map](https://github.com/earthstewards/littermap) application.

## Architecture

- [Amazon API Gateway](https://aws.amazon.com/api-gateway/) REST endpoints
- [AWS Lambda](https://aws.amazon.com/lambda/) serverless back-end logic
- [Amazon RDS](https://aws.amazon.com/rds/) relational database using [PostgreSQL](https://www.postgresql.org/) with [PostGIS](https://postgis.net/) to store global locations
- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) fast and flexible database for user accounts, device sessions and event logs
- Serverless stack deployment with [AWS CloudFormation](https://aws.amazon.com/cloudformation/)
- Session based user authentication and access control
- Sign-in and user identity with [Google Identity API](https://developers.google.com/identity/protocols/oauth2) (extendable to support other providers)

## Requirements

- [aws-cli](https://aws.amazon.com/cli/) (for making AWS requests)
- [sam-cli](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html) (1.29.0 or later) (for managing the serverless stack deployment)
- [jq](https://stedolan.github.io/jq/) (1.5 or later) (for parsing JSON)
- [yarn](https://yarnpkg.com/) (for nodejs dependencies)
- [jshint](https://github.com/jshint/jshint/blob/master/docs/install.md) for linting JavaScript
- [docker](https://docs.docker.com/get-docker/) (for simulating the infrastructure to test functions locally)

## Software involved

- Lambda code uses [node.js](https://nodejs.org/about/) with [postgres](https://github.com/porsager/postgres/) library for database communication.

## Useful utilities

- [awslogs](https://github.com/jorgebastida/awslogs) or [apilogs](https://github.com/rpgreen/apilogs) for viewing AWS logs
- [httpie](https://httpie.io/docs) for making HTTP requests
- [cookie editor](https://cookie-editor.cgagnier.ca/)
- [geocode](https://github.com/alexreisner/geocoder#command-line-interface) utility for address lookups from the command line

## How to deploy

First install the [requirements](#Requirements).

### Configuring AWS

If you don't have an AWS account, [create one](https://aws.amazon.com/resources/create-account/).

Using your root AWS account, create a [new user](https://console.aws.amazon.com/iam/home#/users$new) with programmatic access to the AWS API. Make sure this user has membership in a group with `AdministratorAccess` privileges.

Select the created user on the [users](https://console.aws.amazon.com/iamv2/home#/users) page, and in the `Security credentials` tab choose `Create access key`. Select `Show` to see the secret access key. You will not have access to the key again using the web interface, so make sure to store it in a secure location. The [reference guide](https://docs.aws.amazon.com/general/latest/gr/aws-security-credentials.html) explains AWS security credentials and best practices in detail.

With this information on hand, configure the aws-cli utility with the access key and secret key along with the desired [deployment region](https://aws.amazon.com/about-aws/global-infrastructure/regions_az/) by running:

- `aws configure`

If you've already done that before for another deployment, take a look at [named profiles](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-profiles.html).

Your credentials will now be stored in a local file `~/.aws/credentials` and the AWS command line tools will now be able to execute commands on behalf of this account.

### Deploying the serverless stack

If this is a fresh clone of this source code repository, prepare the configuration files by running:

- `./init-config`

Prepare the stack template and function code for deployment:

- `sam build` ([what this does](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-build.html))

Deploy the stack (ignore values you don't know for now):

- `sam deploy -g` ([what this does](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-deploy.html))

Take note of the values returned in the `Outputs` section. You will need them to configure the front-end client.

Enable outside network access to the database private subnet:

- `./manage rds-db-authorize-ingress`

Perform first-time initialization on the littermap database:

- `./manage rds-db-init`

This will turn on PostGIS and create tables and access roles.

Take note of the `geometry_type_oid` value in the output. It is necessary to provide it, so redeploy the stack with this value provided now:

- `sam deploy -g`

### Configuring "Sign-in with Google" integration

- [Register](https://console.cloud.google.com/apis/credentials/consent/) this application with Google's API services and configure the consent screen details
- Create an OAuth client profile in Google's [OAuth configuration utility](https://console.cloud.google.com/apis/credentials/oauthclient)
- For `Application type` choose `Web application`
- Under `Authorized redirect URIs`, depending on which domains you will be using to test the application, add the appropriate URLs with a path of `/api/auth/google`:
  - `https://` + domain name + `/api/auth/google` (e.g., for production)
  - `https://localhost:9999/api/auth/google` (for local testing)
  - E.g., `https://m2cgu13qmkahry.cloudfront.net/api/auth/google` (for testing with CloudFront CDN)
  - E.g., `https://91kfuezk29.execute-api.us-east-1.amazonaws.com/api/auth/google` (for testing the API directly)
- Take note of the issued `Client ID` and `Client Secret` values
- Update the stack deployment with `sam deploy -g` and specify those values when prompted

### Deploying the front-end

The serverless stack includes S3 buckets for hosting the front-end and user uploaded media content. To deploy a version of the front-end:

- `./manage www-prepare`
- Edit `publish/config.json` to configure it
- `./manage www-publish`

If you turned on `EnableCDN`, the front-end will now available through the CloudFront CDN endpoint.

### Updating the front-end

To deploy the latest version:

- `./manage www-update`
- `./manage www-publish`

To deploy a specific branch or commit:

- `./manage www-update <branch-or-commit>`
- `./manage www-publish`

## Interacting manually with the service

In the following instructions, replace `$BASE` with the API URL that looks something like:

- `https://2lrvdv0r03.execute-api.us-east-1.amazonaws.com/api/`

The active URL for the deployed API can be viewed by running:

- `./manage list-api-urls`

Add a location (anonymous submit must be enabled):

- `echo '{"lat":22.3126,"lon":114.0413,"description":"Whoa!","level":99,"images":[]}' | http -v POST $BASE/add`

Retrieve a location:

- `http -v $BASE/id/1`

Log in (with Google):

- Execute this in a browser: `$BASE/login/google`

Add a location as a logged in user (get the session value from the `Set-Cookie` reponse header):

- `echo '{"lat"-26.049:,"lon":31.714,"description":"Whoa!","level":99,"images":[]}' | http -v POST $BASE/add "Cookie:session=cbdaf7784f85381b96a219c7"`

Log out:

- In a browser: `$BASE/logout`

View today's event log (in UTC):

- `./manage event-log`

View event log for any particular day (specified in UTC):

- `./manage event-log 2021-12-25`

## Administration

### API management

Export the API schema:

- `./manage api-export`

### Database interaction

Perform arbitrary queries on the database by running:

- `./manage rds-db-run <query> [<user>]` (user is: admin, writer, reader; default: admin)

For example, retrieve all the stored locations with:

- `./manage rds-db-run 'SELECT * FROM world.locations;' reader`

The database can be completely reset by running:

- `./manage rds-db-init`

To connect to the database and use it directly, first look up the database user passwords:

- `./manage list-functions | grep PASS | sort -u`

or

- `./manage list-stack-params | grep -i pass`

Get the host address with:

- `./manage list-rds-db-endpoints`

Then connect to the database: (must have [postgresql](https://www.postgresql.org/download/) installed to have the `psql` utility):

- `psql -U {litteradmin|writer|reader} -h {host} -p {port} -d littermap -W`

Type `\help` to get started.

To save money while not using the database during development, it can temporarily [hibernated](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html) with:

- `./manage rds-db-hibernate`

Wake it back up with:

- `./manage rds-db-wake`

## How to remove this service from the cloud

To take this service down, run:

- `./manage stack-delete` ([what this does](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-delete.html))

If that doesn't go smoothly, troubleshoot the issue or delete the stack in the [CloudFormation dashboard](https://console.aws.amazon.com/cloudformation/). Be aware that deleting or changing resources manually will result in [stack drift](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-stack-drift.html?icmpid=docs_cfn_console) and can [create difficulties](https://forums.aws.amazon.com/message.jspa?messageID=510944#512973) that need to be resolved in order to manage the stack.

## Development

After making any changes to the code, run:

- `sam build`

To deploy changes, run:

- `sam deploy`

### Modifying the serverless stack definition

After making adjustments to the stack definition in `template.yml`, optionally check it for errors with:

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

- For quick iteration, create shell aliases for:

  - `sam build && sam deploy`
  - `sam build && sam deploy -g`
  - `sam build && sam deploy --no-confirm-changeset`

- Check javascript code for errors with `./manage lint` before deploying changes to functions
- Colorize JSON output with `jq`, for example: `./manage api-export | jq .`

## Knowledge resources

### Serverless infrastructure with AWS

#### Videos

- [Brief introduction to AWS SAM](https://youtu.be/MipjLaTp5nA)
- [Detailed presentation on AWS SAM deployment](https://youtu.be/CIdUU6rNdk4)
- [Learn to build serverless applications](https://youtu.be/EBSdyoO3goc?list=PLkHoRc4IcLDrgUpLKT7NTJFTM46Gk0cjZ) (playlist)
- [Database design patterns for DynamoDB](https://youtu.be/HaEPXoXVf2k?t=164)
- [Fundamentals of session and token based authentication](https://youtu.be/2PPSXonhIck)
- [Concepts of cloud security](https://youtu.be/pYHla2CQhM4)

#### Reading

- [Defining serverless applications as a single stack using AWS SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html)
- [Understanding database options for your serverless web applications](https://awsfeed.com/whats-new/compute/understanding-database-options-for-your-serverless-web-applications)
- [What can be done with serverless lambda functions](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-features.html)
- [5 AWS mistakes you should avoid](https://cloudonaut.io/5-aws-mistakes-you-should-avoid/)
- [AWS Lambda execution context demystified](https://blog.ippon.tech/lambda-execution-context-demystified/)
- [Using AWS Web Application Firewall to protect your APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-control-access-aws-waf.html)
- [Amazon Web Services: Overview of Security Processes](https://tdcontent.techdata.com/techsolutions/security/assets/files/aws-overview-security-processes.pdf) [pdf]
- [AWS fundamentals cheatsheet](https://github.com/agavrel/aws_fundamentals_cheatsheet)
- [What are the pros and cons of using third party sign-in](https://www.quora.com/What-are-the-pros-and-cons-of-using-Google-Sign-In-for-web-applications/answer/Dagmar-Timler)
- [Selecting an AWS region for your deployment](https://raw.githubusercontent.com/solidjs/solid-realworld/master/src/store/createAgent.js)
- [Caching best practices](https://aws.amazon.com/caching/best-practices/)

### [Amazon RDS](https://aws.amazon.com/rds/) database

Used as the main database to store global locations

> Amazon RDS is a scalable relational database service that is API-compatible with PostgreSQL.

- [What is Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Welcome.html)
- [Build a GIS server site on Amazon Web Services](https://enterprise.arcgis.com/en/server/10.4/cloud/amazon/build-arcgis-server-site-on-aws.htm)
- [Building a simple geodata service with Node, PostGIS, and Amazon RDS](https://blog.geomusings.com/2013/12/11/building-a-simple-geodata-service-with-node-and-amazon-rds/)
- [PostgreSQL on Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Overview of RDS database instance classes](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html)
- [AWS RDS best practices](https://www.cloudconformity.com/knowledge-base/aws/RDS/)
- [Cloning RDS instances for testing](https://blog.dmcquay.com/devops/2015/09/18/cloning-rds-instances-for-testing.html)
- [Database authentication with Amazon RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/database-authentication.html)
- [Using schemas in a PostgreSQL database](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [PostgreSQL NULL values](https://www.tutorialspoint.com/postgresql/postgresql_null_values.htm)
- [Using transaction blocks in PostgreSQL](https://www.postgresql.org/docs/current/sql-begin.html)
- [Connecting to Postgres using node-postgres](https://node-postgres.com/features/connecting)
- [Suggestions on what not to do with PostgreSQL](https://shabaam.co/postgresql-now-utc/)
- [Scaling your Amazon RDS instance](https://aws.amazon.com/blogs/database/scaling-your-amazon-rds-instance-vertically-and-horizontally/)
- [RDS multi availability zone deployments](https://aws.amazon.com/rds/features/multi-az/)

### [DynamoDB](https://aws.amazon.com/dynamodb/) database

Auxiliary database used for event logging

> DynamoDB is a fast and flexible [NoSQL](https://www.mongodb.com/nosql-explained) database that is simple by design but difficult to master. If used correctly, it will scale to terabytes and beyond with no performance degradation.

- [A look at DynamoDB](https://cloudonaut.io/a-look-at-dynamodb/)
- [The basics of DynamoDB](https://www.freecodecamp.org/news/ultimate-dynamodb-2020-cheatsheet/)
- [Data modeling with document databases](https://db-engines.com/en/blog_post/51)
- [Querying on multiple attributes in Amazon DynamoDB](https://aws.amazon.com/blogs/database/querying-on-multiple-attributes-in-amazon-dynamodb/)
- [Best practices for designing DynamoDB paritition keys](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html)
- [Choosing the right DynamoDB partition key](https://aws.amazon.com/blogs/database/choosing-the-right-dynamodb-partition-key/)
- [Best practices for designing and architecting with DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Letting items expire by setting the TTL attribute](https://aws.amazon.com/premiumsupport/knowledge-center/ttl-dynamodb/)
- [Formatting an item's TTL attribute](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/time-to-live-ttl-before-you-start.html#time-to-live-ttl-before-you-start-formatting)
- [Hands on examples with DynamoDB](https://cloudaffaire.com/primary-key-in-dynamodb/)
- [Using DynamoDB with AWS CLI](https://dynobase.dev/dynamodb-cli-query-examples/)
- [How to back up and restore DynamoDB tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/backuprestore_HowItWorks.html)
- [The three main performance limits of DynamoDB](https://www.alexdebrie.com/posts/dynamodb-limits/)
- [Distributed locking](https://formidable.com/blog/2020/distributed-locking/)

### Technical guides

- [Build a serverless website with SAM on AWS (part 1)](https://izifortune.com/serverless-website-sam-aws/)
- [Build a serverless website with SAM on AWS (part 2)](https://izifortune.com/serverless-website-sam-aws-part-2/)
- [Build a serverless API with AWS Gateway and Lambda](https://thenewstack.io/build-a-serverless-api-with-aws-gateway-and-lambda/)
- [Create a Lambda function with AWS command line interface](https://medium.com/swlh/create-a-lambda-function-with-aws-command-line-interface-55e5f2af92e1)
- [AWS Lambda python demo using AWS CLI](https://medium.com/@schogini/aws-lambda-python-demo-using-aws-cli-5b088270784e)
- [AWS APIGateway and Lambda - a GET method CLI demo](https://medium.com/@schogini/aws-apigateway-and-lambda-a-get-mehod-cli-demo-8a05e82df275)
- [AWS API gateway permission to invoke Lambda functions](https://medium.com/@jun711.g/aws-api-gateway-invoke-lambda-function-permission-6c6834f14b61)
- [Correctly invoke HTTP from AWS Lambda without waiting](https://www.sensedeep.com/blog/posts/stories/lambda-fast-http.html)
- [Sharing code between Lambda functions using Layers](https://www.jijutm.com/aws/refactored-a-lambda-heap-to-use-layers/)
- [Overview of user authentication with OAuth](https://www.nylas.com/blog/integrate-google-oauth)
- [Implementing OAuth2 authentication](https://discordjs.guide/oauth2/#a-quick-example)
- [Enable user file uploads with S3 POST signed URLs](https://advancedweb.hu/how-to-use-s3-post-signed-urls/)
- [Serving an SPA from S3 using CloudFront](https://johnlouros.com/blog/using-CloudFront-to-serve-an-SPA-from-S3)
- [Using GitLab CI/CD Pipeline to deploy AWS SAM applications](https://aws.amazon.com/blogs/apn/using-gitlab-ci-cd-pipeline-to-deploy-aws-sam-applications/)

### General articles

- [Programming vs software engineering](https://swizec.com/blog/what-i-learned-from-software-engineering-at-google/)

### Technical articles

- [Basics of maintaining user sessions with cookies](https://web.stanford.edu/~ouster/cgi-bin/cs142-fall10/lecture.php?topic=cookie)
- [Distributed session management in the cloud](https://aws.amazon.com/caching/session-management/)
- [High performance storage strategy for time series data](https://apprize.best/data/series/4.html)
- [Caching at scale](https://d0.awsstatic.com/whitepapers/performance-at-scale-with-amazon-elasticache.pdf) [pdf]
- [Continuous integration vs continuous delivery vs continuous deployment](https://www.atlassian.com/continuous-delivery/principles/continuous-integration-vs-delivery-vs-deployment)
- [Sharp edges in serverless](http://blog.ryangreen.ca/2019/06/18/in-the-cloud-beware-of-sharp-edges-for-there-are-many/)
- [In-depth API gateway configuration](https://nickolaskraus.org/articles/creating-an-amazon-api-gateway-with-a-mock-integration-using-cloudformation/)
- [Understanding the basics of Cross Origin Resource Sharing policies](https://javascript.plainenglish.io/understanding-the-basics-to-fetch-credentials-863b25968ed5)
- [S3 bucket restrictions and limitations](https://docs.aws.amazon.com/AmazonS3/latest/userguide/BucketRestrictions.html)

### More information

- [Using your Google account to sign in to apps or services](https://support.google.com/accounts/answer/112802)
- [Can an AJAX response set a cookie](https://stackoverflow.com/questions/3340797/can-an-ajax-response-set-a-cookie#3340818)

### Security

- [Protecting your users from cross-site scripting exploits](https://en.wikipedia.org/wiki/Cross-site_scripting#Exploit_examples)
- [Protecting your users from cross-site request forgery](https://en.wikipedia.org/wiki/Cross-site_request_forgery#Example)
- [Using an unguessable state parameter to protect against hijacking of the authentication process](https://security.stackexchange.com/questions/203022/oauth-2-state-token-and-protect-csrf)
- [How the Access-Control-Allow-Origin header works](https://medium.com/@dtkatz/3-ways-to-fix-the-cors-error-and-how-access-control-allow-origin-works-d97d55946d9)
- [In-depth overview of CORS](https://www.moesif.com/blog/technical/cors/Authoritative-Guide-to-CORS-Cross-Origin-Resource-Sharing-for-REST-APIs/)
- [User Authenticaiton with OpenID Connect alongside OAuth 2.0](https://oauth.net/articles/authentication/)

### Reference

- [AWS terminology glossary](https://docs.aws.amazon.com/general/latest/gr/glos-chap.html)
- [CloudFormation Ref and GetAtt lookup](https://theburningmonk.com/cloudformation-ref-and-getatt-cheatsheet/)
- [Authentication with Google Identity](https://developers.google.com/identity/protocols/oauth2/openid-connect)
- [HTTP status codes](https://ddg.gg?q=http+status+codes+cheatsheet)
- [Reserved words in DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html)

#### Cheatsheets

- [git (basic)](http://git-cheatsheet.com/)
- [git (advanced)](https://dev.to/maxpou/git-cheat-sheet-advanced-3a17)
- [jq](https://lzone.de/cheat-sheet/jq)
- [bash](https://devhints.io/bash)
- [PostgreSQL](https://www.postgresqltutorial.com/postgresql-cheat-sheet/)
- [PostGIS](http://www.postgis.us/downloads/postgis21_cheatsheet.pdf) [pdf]

## Quick links

- [Manage this application](https://console.aws.amazon.com/lambda/#applications)
- [Your CloudFormation stacks](https://console.aws.amazon.com/cloudformation/)
- [Your Lambda functions](https://console.aws.amazon.com/lambda/home#/functions)
- [Your API gateways](https://console.aws.amazon.com/apigateway/main/apis)
- [Your DynamoDB tables](https://console.aws.amazon.com/dynamodb/home#tables)
- [Your RDS database instances](https://console.aws.amazon.com/rds/home#databases:)
- [CloudWatch logs](https://console.aws.amazon.com/cloudwatch/home#logsV2:log-groups)
- [Identity and Access Management](https://console.aws.amazon.com/iam/)
- [Google account app permissions](https://myaccount.google.com/permissions)
- [Markdown previewer](https://mdpreviewer.github.io/)
