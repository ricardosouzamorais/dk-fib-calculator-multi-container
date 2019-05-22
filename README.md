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

### Memory

This parameter is **required**. The value should be specified in MB.

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

# Kubernetes

There are some tools that will be used at both Dev and Prod environments like `kubectl`. On the other hand others are for Dev only like `minikube`.

![Dev v.s. Prod](/docs/images/kubernetes-tools-dev-vs-prod.png)

## Local Installation

We need `kubectl` that is a CLI for interacting with our master and cluster.<br/>
We also need a VM driver like VirtualBox that will be used to be our single node and last but not least, `minikube` for managing the VM that will run a single node.

![Local Kubernetes Development](/docs/images/kubernetes-local-dev.png)

### Installation on MacOS

![Installation on MacOS](/docs/images/kubernetes-install-macos.png)

## Docker Compose V.S Kubernetes

### Docker Compose Structure

![Docker Compose Structure](/docs/images/docker-compose-structure.png)

### Diferences between them
![Differences](/docs/images/docker-compose-vs-kubernetes-differences.png)

### What to do for a local Kubernetes Cluster

![What To Do](/docs/images/docker-compose-vs-kubernetes.png)

## Config files

### Keyworkd `kind`

The `kind` entry inside of all configuration files is meant to represent or indicate the type of object that we want to make.

Objects are essentially things that are going to be created inside our Kubernetes cluster to get our application to work the way we might expect.

![Kubernetes Config Files](/docs/images/kubernetes-config-files.png) 

*  ***Pod*** is used to run a container
*  ***Service*** is used to setup networking

The are other object types like ***Deployment*** that can be used to config Pods and their properties that cannot be changed when using object type **Pod** .

![Kubernetes Config Files 2](/docs/images/kubernetes-config-files-2.png) 

*  ***Deployment*** is used to maintain a set of identical pods, ensuring that they have the correct configuration, the right number instances and in a runnable state

#### Pods V.S. Deployments

![Pods V.S. Deployments](/docs/images/kubernetes-pods-vs-deployments.png) 

In a production environment, we do not use ***Pods*** but ***Deployments***.

When we create a Deployment object, it is going to have attached to it something called a ***Pod Template*** that is a little block of configuration file that says what any ***Pod*** that is created by that deployment is supposed to look like.<br/>
The behaviour is different from ***Pod***, for example, in case we change the port, the deployment will try to change the existing or alternatively attempt to kill this part entirely and replace it with a brand new ***Pod***. So, we can change any piece of configuration tied to a ***Pod*** that we want to.

![Deployments To Pods](/docs/images/kubernetes-deployment-template.png)

### Keyword `apiVersion`

When we specify the API version at the very top of the file that essentially limits the types of objects that we can specify winint a given configration file.

The following diagram does not represents all types available on both examples of APIs.

![apiVersion](/docs/images/kubernetes-config-files-apiversion.png) 

The `name` and `type` are the unique identifying token for any object that we create in **k8s** cluster.

## Config file for a container (Pod - client-pod.yaml)

When minikube starts it creates a VM on your computer that is referenced as a ***Node*** and that is going to be used by Kubernetes to run some number of different objects.<br/>
The most basic object is something that is referred as ***Pod***.

![Pod](/docs/images/kubernetes-pod.png) 

The ***Pod*** itself is essentially a grouping of containers with a very similar purpose.It means that absolutely positively must be deployed together and must be running together in order for application to work correctly. In the world of a ***Pod** when we start to group containers together, we are grouping them because they have a very tightly coupled relationship and must be executed with each other.

As an example, image a ***Pod*** that is running three containers as the following diagram and would be a good example of when we would use a ***Pod*** with multiple containers.

![More than one container per Pod](/docs/images/kubernetes-pod-more-than-one-container.png)

The *looger* is 100% intended to connect to *postgres* container and pull some information from that. If *postgres* goes way, *logger* will be completely useless.

We cannot deploy individual containers by themselves as we could with **docker**, **docker compose** or **AWS Beanstalk**. The smallest thing we can deploy into a **k8s** cluster is a ***Pod***, so anytime we want to deploy a container, we need a ***Pod***.

### Metadata section

The `name` is name of the ***Pod*** that is being created and that is motly used for a lot of logging purposes.<br/>
The `labels` defines labels for that ***Pod*** that can be used to link to ***Service*** type of object.

### Spec section

In the `spec` section of config file, we have just one container which has its `name` as an arbitrary name, the `image` as one available from **docker hub** and `ports` that specifies the available container ports that we are going to expose to the outside world.

Why are we going to expose port 3000? Remember that our clients container has an **Nginx** which exposes the React bundle build file and that listens on port 3000. But that is not enough on world of Kubernetes. In order to have that `containerPort` mapped correctly, we need the second configuration file for networking setup.

## Config file for network setup (Service - client-node-port.yaml)

![Pods and Services](/docs/images/kubernetes-pods-services.png)

We use that kind of object for setting up networking in a **k8s** cluster. This kind of object has subtypes as shown in following image:

![Services Subtypes](/docs/images/kubernetes-pods-services-subtypes.png)

In our config file, we used ***NodePort*** as the subtype of ***Service***, in `spec` section, and that is the way we expose a container to the outside world. It allows to open up your web browser and access that running container.<br/>
This is good for development purposes only and we DO NOT use ***NodePort*** as a service type on production environments except on one or two very specific exceptions that will be treat during the course.

#### The final picture for development client running on your local machine

Every single node or member of **k8s** cluster has a program on it called `kube-proxy` which works as on single window to the outside world.

![Final Art](/docs/images/kubernetes-client-final-picture-flow.png)

### `selector` section

Rather than using any naming system which would point to the client ***Pod***, we use a label selector system available at **k8s**.

In our ***Pod*** config file you can see `component: web`and it is a key-value, so it could be any value like `tier: frontend`, for example. We just need to have the ***Pod*** and ***Service*** configured with the same key-value.

![Label Selector System](/docs/images/kubernetes-client-final-picture-flow-detailed.png)

### `ports` section

It describes all collection of ports, in an array format, that need to be opened up or mapped on the target object.

![NodePort Service](/docs/images/kubernetes-nodeport-service.png)

The `port` is going to be the port that another ***Pod*** or another container inside of **k8s** cluster could use to access our client ***Pod***. At this time, it is not useful because we do not have any other objects or anything else inside of our **k8s** cluster that is going to attempt to reach into that client ***Pod***.

The `targetPort` is identical to `containerPort` from ***Pod*** config file and representes the port that is available on the ***Pod*** to where ***Service*** redirect traffics to.

The `nodePort` is the port that we will use to access the client ***Pod*** throught the browser, so it what is exposed to the outside world.<br/>
`nodePort` is always going to be a number between *30000* and *32767* but it is not a non required property. In case you do not specify it, it will be randomly assigned.

Of course, as we do not use the `NodePort` ***Service*** in a production environment, this randomly assignment is not a problem.

## Config file for a deployment (Deployment - client-deployment.yaml)

The content inside `template` section is exactly the same of `spec` section of the `client-pod.yaml` file excepting by the missing `name` key inside `metadata`.<br/>
This template section defines the exactly configuration that should be used for every ***Pod*** that is created and maintained by this deployment.

### `spec` section

*  `replicas` represents the number of different pods that this deployment is supposed to make
*  `selector/matchLabels` works very similar to the selector we used in ***NodePort*** service


## Feed a config file to Kubectl

Use the command: `kubectl apply -f FILENAME`

![Feed config file to Kubectl](/docs/images/kubectl-feed-config-file.png)

In order to get a status of any object that we submitted we can use the command: `kubectl get OBJECT_TYPE`

It grabs the status of an entire groups of object types, for example:
*  `kubectl get pods`
*  `kubectl get services`
*  `kubectl describe <object type> <object name>`

When running `kubectl get services` we will dot not see the `targetPort`:

|NAME|TYPE|CLUSTER-IP|EXTERNAL-IP|PORT(S)|AGE|
|---|---|---|---|---|---|
|client-node-port|NodePort|10.102.212.13|<none>|3050:31515/TCP|2m18s|
|kubernetes|ClusterIP|10.96.0.1|<none>|443/TCP|5d22h|

## Remove an object

We can use (imperative command): `kubectl delete -f FILENAME`

## Accessing the client

If we try to access `http://localhost:31515` we will not get the page because all the ports that we are dealing are relate the the VM created by `minikube`. We actually need the IP address assigned to this VM. To get this IP address, just run: `minikube ip`

## Updating a Config File

**k8s** uses the `name` and the `type` ir order to check if the object has to be updated on the cluster or created.<br/>
Despite that, not all config properties can be changed, only the image usage, some other image properties, some active deadline or tolerations property.

## Kubernetes Architecture Summary and Deployment

### Summary
![Summary](/docs/images/kubernetes-architecture-diagram-summary.png)

### Deployment
![Detailed](/docs/images/kubernetes-architecture-diagram-detailed.png)

## Kubernetes Takeways

![Important Takeaways](/docs/images/kubernetes-important-takeaways.png)

## Imperative V.S. Declarative approaches

When you start looking at ***k8s*** documentation, blog posts, stackoverflow and whatever else, you are going to see some resources recommending the **Imperative Approach**. `kubectl` can go on both ways.<br/>
For real production deployment, every engineer out there, everyone in the community, is always to advocate taking the declarative approach.

![Imperative V.S. Declarative approaches](/docs/images/kubernetes-imperative-vs-declarative-deploy.png)