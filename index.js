const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000;

// For Tracking Id
const crypto = require("crypto");

function generateTrackingId() {
  const prefix = "PRCL";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const random = crypto.randomBytes(3).toString("hex").toUpperCase();

  return `${prefix}-${date}-${random}`;
}

//  for Booking Id
function generateBookingId() {
  const prefix = "BK";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${date}-${random}`;
}
// --------------------------------------

const admin = require("firebase-admin");

// const serviceAccount = require("./etuitionbd-firebase-adminsdk.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8",
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(express.json());
app.use(cors());
// middleware with database access

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
    const paymentCollection = db.collection("payments");

    const verifyFBToken = async (req, res, next) => {
      const token = req.headers.authorization;

      if (!token) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      try {
        const idToken = token.split(" ")[1];
        const decoded = await admin.auth().verifyIdToken(idToken);
        console.log("after token validation", decoded);
        req.decoded_email = decoded.email;
        next();
      } catch (err) {
        return res.status(401).send({ message: "unauthorized access" });
      }
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded_email;
      // console.log(req.headers);
      const query = { email };
      const user = await userCollection.findOne(query);

      console.log(user);

      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // Api Fetching starts here
    // User Api
    app.get("/tuitions", async (req, res) => {
      const query = { status: "Approved" };

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

    // Get specific tuition for payment
    app.get("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.findOne(query);
      res.send(result);
    });

    // to get applications
    app.get("/applications/:id", async (req, res) => {
      const tuitionID = req.params.id;
      const query = { tuitionID };
      const result = await bookingCollection.find(query).toArray();
      // console.log(result);
      res.send(result);
    });

    // To get student's Listings
    app.get("/my-tuitions", verifyFBToken, async (req, res) => {
      const email = req.query.email;
      const result = await tuitionsCollection.find({ email: email }).toArray();
      res.send(result);
    });

    // Get all the pending pending tuition posts
    app.get("/pending-tuitions", async (req, res) => {
      const query = {};
      if (req.query.status) {
        query.status = req.query.status;
      }
      const cursor = tuitionsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/users/:id", async (req, res) => {});

    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    app.get("/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // to get payment history
    app.get("/payments", verifyFBToken, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.customerEmail = email;
      }
      const cursor = paymentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/student-payments", async (req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.customerEmail = email;
      }
      const cursor = paymentCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // To store data for Applies
    app.post("/application", verifyFBToken, async (req, res) => {
      const data = req.body;
      const bookingData = {
        ...data,
        bookingId: generateBookingId(), // ✅ ADD THIS
        createdAt: new Date(),
      };

      const result = await bookingCollection.insertOne(bookingData, data);

      // const query = { _id: new ObjectId(applyId) };
      // const updateStatus = {
      //   $set: { availabilityStatus: "Booked" },
      // };
      // const updateResult = await bookingCollection.updateOne(query, updateStatus);
      res.send(result);
    });

    app.post("/tuitions", verifyFBToken, async (req, res) => {
      const tuition = req.body;
      tuition.createdAt = new Date();
      tuition.status = "pending";
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

    app.post("/tutor-details", verifyFBToken, async (req, res) => {
      const tutor = req.body;
      tutor.status = "pending";
      const result = await tutorDetailsCollection.insertOne(tutor);
      res.send(result);
      console.log(result);
    });

    // To update any existing tuition
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

    // to make Admin to anyone
    app.patch("/users/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const roleInfo = req.body;
      // console.log(roleInfo, id);
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: roleInfo.role,
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      // console.log(result);
      res.send(result);
    });

    // To approve tuition pending post
    app.patch("/pending-tuitions/:id", verifyFBToken, async (req, res) => {
      const status = req.body.status;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: status,
        },
      };

      const result = await tuitionsCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // to delete tuition detail
    app.delete("/tuition/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tuitionsCollection.deleteOne(query);
      res.send(result);
    });

    // Delete user
    app.delete("/users/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      try {
        // Optional: Check if user is trying to delete themselves
        const userToDelete = await userCollection.findOne(query);
        if (userToDelete.email === req.decoded_email) {
          return res
            .status(400)
            .send({ message: "You cannot delete yourself" });
        }

        const result = await userCollection.deleteOne(query);

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Error deleting user", error });
      }
    });

    // payment related apis
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;
      console.log("Payment Info:", paymentInfo);
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "USD",
              product_data: {
                name: "Tuition Payment",
              },
              unit_amount: amount,
            },

            quantity: 1,
          },
        ],
        customer_email: paymentInfo.studentEmail,

        metadata: {
          applicationId: paymentInfo.bookingId,
        },
        mode: "payment",
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
      });

      // Post and delete to remove and accepting application

      console.log(session);
      res.send({ url: session.url });
    });

    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      // console.log("session retrieved", session);

      // doing this for preventing duplication of payment
      const transactionId = session.payment_intent;
      const query = { transactionId: transactionId };

      const paymentExist = await paymentCollection.findOne(query);

      if (paymentExist) {
        return res.send({
          message: "already exists",
          transactionId,
          trackingId: paymentExist.trackingId,
        });
      }

      const trackingId = generateTrackingId();

      if (session.payment_status === "paid") {
        const id = session.metadata.applicationId;
        // console.log("payment success Id:", id);
        const query = { _id: new ObjectId(id) };
        // console.log("payement success query:", session.metadata);
        const update = {
          $set: {
            status: "paid",
            trackingId: trackingId,
          },
        };
        const result = await bookingCollection.updateOne(query, update);
        // console.log("payment Success:", result);

        const payment = {
          amount: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_email,
          name: session.product_data,
          applicationId: session.metadata.applicationId,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          paidAt: new Date(),
          trackingId: trackingId,
        };

        if (session.payment_status === "paid") {
          const resultPayment = await paymentCollection.insertOne(payment);
          res.send({
            success: true,
            modifyParcel: result,
            trackingId: trackingId,
            transactionId: session.payment_intent,
            paymentInfo: resultPayment,
          });
        }
      }

      res.send({ success: false });
    });

    // Reject (delete) an application by ID
    app.patch("/reject/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          status: "rejected",
        },
      };
      const result = await bookingCollection.updateOne(query, update);

      res.send({ result });
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
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
