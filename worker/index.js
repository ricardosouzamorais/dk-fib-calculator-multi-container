const keys = require('./keys');
const redis = require('redis');

/*
 * If lose connection to Redis Server, attempt automatically to reconnect 
 * to the server, once every 1000 milliseconds/1 seconds.
 */
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

// For subscription
const redisSubscriber = redisClient.duplicate();

// Doing that recursevily is not best solution so that is the reason why 
// we are separating that on a worker process that run dettached from React App
function fib(index) {
    if (index < 2) return 1;
    return fib(index - 1) + fib(index - 2);
}

redisSubscriber.on('message', (channel, message) => {
    redisClient.hset('values', message, fib(parseInt(message)));
});

redisSubscriber.subscribre('insert');