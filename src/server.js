let express = require('express');
let path = require('path');
let fs = require('fs');
let MongoClient = require('mongodb').MongoClient;
let bodyParser = require('body-parser');
let app = express();
// import * as amqp from "amqplib";
let amqp = require("amqplib");
let cors = require('cors');

app.use(cors({
    origin: '*',
}));

let connection;
let channel;


// last thing i did was try and push the image to docker hub after changing the username and password
// need to restart deployment

const connectRabbitMQ = async() => {
    try {

        // connection = await amqp.connect("amqp://default_user_h19T9cxik7_FXOICj2Y:r_h_Tv11_oVQ2pts5BE0lMncX9RxfY68@10.97.41.66");
        connection = await amqp.connect("amqp://default_user_vhXiqo25-DTR2LqMtco:EfW7erd8bS8ihz7g5o56mPAPDofHmyCe@10.111.88.38:5672");

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
    console.log("get profile");

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