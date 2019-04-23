# Application Architecture

## Application Flows

![User Submit Flow](/docs/images/user-submit-flow.png)

![Database Repositories](/docs/images/information-repositories.png)

## Development Application Architecture
![Development Application Architecture](/docs/images/architecture-01.png)

## Production Application Architecture
![Development Application Architecture](/docs/images/architecture-02.png)

## Worker
Is what is going to watch Redis and anytime that it gets a new index inserted into Redis, will automatically pull the value out and calculate the appropriate Fibonacci value for it and inser the value back into Redis.

### Duplicating Redis Client

According to Redis documentation if we ever have a client we have a client that is listenning ou publishing information on Redis, we have to make a duplicate connection because when a connection is turned into a connection that is going to listen or subscribe or publish information it cannot be used for other purporses.

# Environment Variables

When we build an image it a two-step process: build the image (something like preparation) and some point in the future when we actually run the container that is second part, take an image and run an instance from it.

When we setup an environment variable inside of a docker-compose file we are setting up an environment variable that is applied at runtime, so ONLY WHEN THE CONTAINER IS STARTED UP.
The information will not be encoded inside the image.

![Environment Variables](/docs/images/env-variables.png)

We will be using the first sintax because we are not going to have anything configured on our computer.

## The name of the service

When specifying the host for Redis or Postgres we can use the service name specified in the docker-compose file.

# Nginx Path Routing

Nginx will be used even for the development process.

![Nginx Path Routing](/docs/images/nginx-path-routing-01.png)

 It is going to look at all these different requests and decide on which backend service of ours that we want to route the request to.

![Requests from browser](/docs/images/nginx-path-routing-02.png)

The client thinks that it needs to make request to slash API but it is very clear that the server is not set tup to receive that /api route.

## Why didn't we specify different ports for React and Express services ?

Think about our application runs on a production environment. We probably don't want to have to worry about juggling these different ports. It would be a lot nicer if all of our frontend React code just make requests to some common backend and not have to worry about specifying the requests per service.

If you check the Express routes, we will not see /api because it will be handled by Nginx path routing.
When it comes in to Nginx, it is going to have the /api but when it comes out Nginx to Express, it is going without the /api, like /values/all, for example.

## The default.conf

The `server client` points to the service that if delivered by `client` name and that is configured at docker-compose file.

```
upstream client {
    server client:3000;
}

upstream api {
    server api:5000;
}

server {
    listen 80;

    location / {
        proxy_pass http://client;
    }

    location /sockjs-node {
        proxy_pass http://client;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }

    location /api {
        rewrite /api/(.*) /$1 break;
        proxy_pass http://api;
    }
}
```

The configuration above is something like a developer piece of configuration. If you are doing production, do not use that.

### Rewrite rule

When the request comes in for /api we need to chop off the /api to send to server api.
In the `rewrite /api/(.*) /$1 break;` sintax the `/$1` represents anything that is catch by the regular expression `(*.)`.
The break essentially means to do not try to apply any other rewrite rules after applying this one.

### Websocket Connection

The React version that was shown on the course was complaining about Websocket connection error, so we had to configure the proxy for that in the Nginx default configuration file.

# Deployment on AWS

Instead of making the build into the AWS EB environment, lets create an image, publish that on dockerhub and tell AWS EB to pulls the image from Docker Hub and deploy it.

![Multi Container Setup](/docs/images/multi-container-aws.png)

## Configuring Production Dockerfile

For worker and server the files are the same, except for the `npm run dev` that is changed by `npm run start`.

The dockerfile for nginx is also slightly different because it uses a differente configuration file where there is none Websocket proxy configuration.

Related to the client (React app) it will be a little bit different because we do have multi Nginx instances.

### Development env
![Nginx instance for Dev](/docs/images/multi-nginx-instances-01.png)

### Production env
![Nginx instances for Prod](/docs/images/multi-nginx-instances-02.png)

The Nginx that is doing the Routing could route the API to Express Server and have inside it the bundle code of React App. However, you might want to run multiple copies of Nginx so the easiest reason for that might be to server up our Prod React App over there.

### Travis Flow and Configuration

![Travis Flow](/docs/images/travis-flow.png)

Since we have test suite only for React App, we will consider only the return of that.

## Deploying multiple container application

Anytime we want to run multiple separate containers on Elastic Beanstalk at the same time, we have to go through an extra step of configuration to tell EB exactly how to treat our project.

Inside our project directory we are going to create a file with a very special name: `Dockerrun.aws.json`

It is going to tell Elastic Beanstalk where to pull all of our images from, what resources to allocate to each one, how to set uo some port mappings and some associated information.
It is very similar to `docker-compose.yml` file that encodes a lot of directions that would normally be passed directly to `docker run`

![Docker-Compose vs Dockerrun.aws](/docs/images/docker-compose-dockerrun-aws.png)

In docker-compose we specify a bunch of different services ant then with each service we tell docker how to build the image, what ports to open, environment variables and a bunch of stuff like that. It is very similar into `Dockerrun.aws.json`, but instead of refering those things as services, they are called **Container Definitions**.

The biggest difference between them is that docker compose it is going to contain some information about how to build an imagem, using a docker file, while with WAS we already have the images into docker hub, due to Travis Build process. Also `Dockerrun.aws.json` is customized to work directly with AWS.

### Behind the scenes

Elastic Beanstealk doesn't actually know how to work with containers, especially a multi container environment.

Behind the scenes, it is delegating that hosting off to another sevice that is provided in AWS called Elastic Container Service (ECS).

![Elastic Beanstalk behind the scenes](/docs/images/beanstalk-ecs.png)

#### Links to AWS documentation
*  [Task Definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definitions.html)
*  [Task Definitions Parameters - Container Definitions](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#container_definitions)

### Hostname

Similar to the service definition of `docker-compose.yml`. For the server we called that **api** due to reserved word `server` on Nginx config file.

We do not need to specify the `hostname` (parameter is optional) for Nginx since we do not need any of the other containers talk to Nginx. The flow is from Nginx to the other services. We kept bu not needed.

### Essential

When specifyiung your container definitions, `essential` means that if it is marked as `true`, if that container crashes, all other containers in this groups of containers will be closed down at the same time, even if they are running ok. 
In our case, with our current architecture, if Nginx crashed, the user is not able to access anything. So this service will be marked as essential.

At least one service of the list of your containers must be marked as `essential`.

### Links

In **docker compose** a network is created between the specified services but for **AWS ECS**, we need to form up links between the containers.

In our architecture, we need that **Nginx container** talks to **client** and **server** containers. This configuration takes the value of `name` attribute, not the `hostname`, so for server/api, it has to be `server`.

![Nginx links to Server and Client](/docs/images/nginx-links.png)

Links are unidirectional, so Nginx can point to client, but the other one, it is not possible.

# Databases on Containers

We are going to use to external services, provided by AWS, RDS and ElastiCache, check the diagram on section [Production Application Architecture](http://oglobo.com.br).
These services are not customized for using with AWS Elastic Beanstalk nor Containers.

![ElastiCache Features](/docs/images/aws-elasticache.png)

![RDS Features](/docs/images/aws-rds.png)

# AWS - VPC and Security Groups

![VPC and our services](/docs/images/vpc-and-our-services-01.png)

![VPC and Security Group](/docs/images/vpc-and-our-services-02.png)

When we create the AWS Elastic Beanstalk environment, a security group is created by default, making able to receive connections on port 80 from everywhere in the globe.

# Environment Variables on Beanstalk

When setting them, they are valid for all the containers, differently from `docker-compose.yml`.