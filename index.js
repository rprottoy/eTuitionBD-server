const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 3000;

// const admin = require("firebase-admin");
// const serviceAccount = require("./etuitionbd-firebase-adminsdk-fbsvc.json");

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// middleware
app.use(express.json());
app.use(cors());

const verifyFBToken = async (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

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
    const tutorDetailsCollection = db.collection("tutorDetails");
    const userCollection = db.collection("users");
    const bookingCollection = db.collection("bookings");

    // Api Fetching starts here
    // User Api
    app.get("/tuitions", async (req, res) => {
      const query = {};

      const cursor = tuitionsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Api for all users
    app.get("/tutors", async (req, res) => {
      const query = {};

      const cursor = tutorDetailsCollection.find(query);
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

    // To get Tutor for homepage 4
    app.get("/tutor-homepage", async (req, res) => {
      const query = {};
      const cursor = tutorDetailsCollection.find(query).limit(4);
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

    // To get student's Listings
    app.get("/my-tuitions", async (req, res) => {
      const email = req.query.email;
      const result = await tuitionsCollection.find({ email: email }).toArray();
      res.send(result);
    });

    app.post("/tuitions", async (req, res) => {
      const tuition = req.body;
      PerformanceObserverEntryList.createdAt = new Date();
      const result = await tuitionsCollection.insertOne(tuition);
      res.send(result);
    });

    // users APIs
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log(user);
      user.role = user.role || "student";
      user.createdAt = new Date();

      const email = user.email;
      const userExists = await userCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user Exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send({ ...result, data: { ...result.data, ...user } });
    });

    app.get("/users/:id", async (req, res) => {});

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    // to make Admin to anyone
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const roleInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: roleInfo.role,
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // To store data for Applies
    app.post("/myApplies", async (req, res) => {
      const data = req.body;
      // const applyId = data._id;
      // console.log(data, id);

      const result = await bookingCollection.insertOne(data);

      // const query = { _id: new ObjectId(applyId) };
      // const updateStatus = {
      //   $set: { availabilityStatus: "Booked" },
      // };
      // const updateResult = await bookingCollection.updateOne(query, updateStatus);
      res.send(result);
    });

    app.post("/tutor-details", async (req, res) => {
      const tutor = req.body;
      const result = await tutorDetailsCollection.insertOne(tutor);
      res.send(result);
      console.log(result);
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

    // to delete tuition detail
    app.delete("/tuition/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tuitionsCollection.deleteOne(query);
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
