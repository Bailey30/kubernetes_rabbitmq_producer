let express = require('express');
let path = require('path');
let fs = require('fs');
let MongoClient = require('mongodb').MongoClient;
let bodyParser = require('body-parser');
let app = express();
// import * as amqp from "amqplib";
let amqp = require("amqplib");
let cors = require('cors');


const k8s = require('@kubernetes/client-node');



app.use(cors({
    origin: '*',
}));

let connection;
let channel;


// last thing i did was try and push the image to docker hub after changing the username and password
// need to restart deployment


async function getServiceClusterIP(serviceName, namespace) {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    try {
        const service = await k8sApi.readNamespacedService(serviceName, namespace);
        return service.spec.clusterIP;
    } catch (error) {
        console.log("error getting service clusterIP: ", error);
    }
}

const connectRabbitMQ = async() => {
    try {


        getServiceClusterIP("hello-world", "default")
            .then((clusterIP) => {
                console.log(`ClusterIP of ${serviceName} in ${namespace}: ${clusterIP}`);
            })
            .catch((error) => {
                console.error('Error:', error);
            });

        // connection = await amqp.connect("amqp://default_user_h19T9cxik7_FXOICj2Y:r_h_Tv11_oVQ2pts5BE0lMncX9RxfY68@10.97.41.66");
        // connection = await amqp.connect("amqp://default_user_zr37xV6wIH_rXbkMbP1:W1i3xQ8q7dTZMK0fvyZyJpfW7Pw8Q809@10.102.238.168");
        connection = await amqp.connect(`amqp://${process.env.SECRET_USERNAME}:${process.env.SECRET_PASSWORD}@10.102.238.168`);

        channel = await connection.createChannel();
        await channel.assertQueue("update_profile", { durable: false });
    } catch (error) {
        console.log("error", error)
    }
};

connectRabbitMQ();


app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, "index.html"));
});


// use when starting application locally
let mongoUrlLocal = "mongodb://admin:password@localhost:27017";

// use when starting application as docker container
let mongoUrlDocker = "mongodb://username:password@producer-mongodb-service:27017";

// pass these options to mongo client connect request to avoid DeprecationWarning for current Server Discovery and Monitoring engine

let mongoClientOptions = { useNewUrlParser: true, useUnifiedTopology: true };

// "user-account" in demo with docker. "my-db" in demo with docker-compose
let databaseName = "producer-mongodb";

app.post('/update-profile', async function(req, res) {
    console.log("update profile");
    try {

        let userObj = req.body;

        let client = await MongoClient.connect(mongoUrlDocker, {})


        let db = client.db(databaseName);
        userObj['userid'] = 1;

        let myquery = { userid: 1 };

        let newvalues = { $set: userObj };

        await db.collection("users").updateOne(myquery, newvalues, { upsert: true })

        client.close();
        console.log("updated/inserted");

        channel.sendToQueue("update_profile", Buffer.from(JSON.stringify(newvalues)));

        // Send response
        res.send(userObj);
    } catch (error) {
        res.status(500).json({ status: 500, message: 'Internal Server Error', error: error.message })
    }

});

app.get('/get-profile', async function(req, res) {
    console.log("test")
    console.log("get profile");
    console.log(process.env.SECRET_USERNAME);
    console.log(process.env.SECRET_PASSWORD);

    try {
        // Connect to the database
        const client = await MongoClient.connect(mongoUrlDocker, mongoClientOptions);


        // Access the database
        const db = client.db(databaseName);

        // Query the collection
        const myquery = { userid: 1 };
        const result = await db.collection("users").findOne(myquery);

        // Close the connection
        client.close();

        // Send response
        res.send(result ? result : {});
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
app.listen(3000, function() {
    console.log("app listening on port 3000!");
});