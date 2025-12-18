const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const port = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors());

// Mongodb Connection string
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.plgjzw8.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("eTuitionBD_db");
    const tuitionsCollection = db.collection("tuitions");
    const tutorDetailsCollection = db.collection("users");
    const userCollection = db.collection("tutorDetails");

    // Api Fetching starts here
    // User Api
    app.get("/tuitions", async (req, res) => {
      const query = {};

      const cursor = tuitionsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // To get Tuitions for homepage 4
    app.get("/tuition-homepage", async (req, res) => {
      const query = {};
      const cursor = tuitionsCollection.find(query).limit(4);
      const result = await cursor.toArray();
      res.send(result);
    });

    // To get a specific tuition
    app.get("/tuition-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tuitionsCollection.findOne(query);
      res.send(result);
    });

    app.post("/tuitions", async (req, res) => {
      const tuition = req.body;
      const result = await tuitionsCollection.insertOne(tuition);
      res.send(result);
    });

    // users APIs
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "student";
      user.createdAt = new Date();

      const email = user.email;
      const userExists = await userCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user Exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.post("/tutor-details", async (req, res) => {
      const tutor = req.body;
      const result = await tutorDetailsCollection.insertOne(tutor);
      res.send(result);
    });

    // To update any existing car
    app.patch("/update-tuition/:id", async (req, res) => {
      const id = req.params.id;
      const updatedTuition = req.body;

      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          class: updatedTuition.class,
          days: updatedTuition.days,
          subject: updatedTuition.subject,
          time: updatedTuition.time,
          location: updatedTuition.location,
          salary: updatedTuition.salary,
        },
      };
      const options = {};
      const result = await tuitionsCollection.updateOne(query, update, options);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("eTuitionBd is running fine");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
