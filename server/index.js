const keys = require('./keys');

// Exprss App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors()); //Cross-Origin Resource Sharing
app.use(bodyParser.json());

// PostgreSQL Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
    host: keys.pgHost,
    port: keys.pgPort,
    database: keys.pgDatabase,
    user: keys.pgUser,
    password: keys.pgPassword
});
pgClient.on('error', () => console.log('Lost PG connection'));

// Create the table if not exists
pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
    .catch(err => console.log(err));

// Redis Client Setup
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

// For publication
/* According to Redis documentation if we ever have a client
 * we have a client that is listenning ou publishing information 
 * on Redis, we have to make a duplicate connection because when
 * a connection is turned into a connection that is going to listen
 * or subscribe or publish information it cannot be used for other
 * purporses. That is the reason why we need it.
 */
const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get('/', (req, res) => {
    res.send('Hi');
});

app.get('/values/all', async (req, res) => {
    const values = await pgClient.query('SELECT * FROM values');

    // Only get the rows and not any metadata that is returned
    res.send(values.rows);
});

// The Redis library does not have Promisses support, so need to use callbacks
app.get('/values/current', async (req, res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values);
    });
});

app.post('/values', async (req, res) => {
    const index = req.body.index;

    // The method that we user to calculate Fib takes time so in order to not
    // freeze the program, we will not calculate when it is greater than 40
    if (parseInt(index) > 40) {
        return res.status(422).send('Index too high.');
    }

    // Putting the default value on the Redis (not calculated).
    // The worked is going to replace that.
    redisClient.hset('values', index, 'Nothing yet calculated!');
    // Telling the worker that is time to calculate
    redisPublisher.publish('insert', index);

    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

    res.send({ working: true });
});

app.listen(5000, err => {
    console.log('Listening on port 5000');
});