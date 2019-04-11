# Application Architecture

The architecture for this Fibonacci calculator could be seen in the following diagrams:

## Worker
Is what is going to watch Redis and anytime that it gets a new index inserted into Redis, will automatically pull the value out and calculate the appropriate Fibonacci value for it and inser the value back into Redis.

### Duplicating Redis Client

According to Redis documentation if we ever have a client we have a client that is listenning ou publishing information on Redis, we have to make a duplicate connection because when a connection is turned into a connection that is going to listen or subscribe or publish information it cannot be used for other purporses.