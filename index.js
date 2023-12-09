const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: [
    'https://elated-zoo.surge.sh'
  ],
  credentials:true
}));
app.use(express.json());
app.use(cookieParser());


// console.log(process.env.DB_PASS);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.acqlwci.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
client.connect().then(()=>console.log('connected'))

// middlewares
const logger = (req,res,next)=>{
  console.log( 'log: info', req.method,req.url);
  next();
}

const verifyToken = (req,res,next)=>{
  const token = req.cookies?.token;
  // console.log('token in the middleware',token);
  if(!token){
    return res.status(401).send({message:'unauthorized access'})
  }
  jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
    if(err){
      return res.send({message:'unauthorized access'})
    }

    req.user = decoded;
    next();
  })

}


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    const serviceCollection = client.db('hotelRoom').collection('services');
    const bookingCollection = client.db('hotelRoom').collection('bookings')

    // auth related API
    app.post('/jwt', logger, async (req, res) => {
      const user = req.body;
      console.log('user for token', user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      })
        .send({ success: true });
    })

    app.post('/logOut', (req, res) => {
      const user = req.body;
      console.log('Logging out', user);
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })



    // services related
    app.get('/services', async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.sort({ availability: -1 }).toArray();
      res.send(result)
    })




    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }

      const options = {
        projection: { image: 1, description: 1, price_per_night: 1, room_size: 1, availability: 1, special_offer: 1 }
      }

      const result = await serviceCollection.findOne(query);
      res.send(result)
    })

    // bookings
    app.get('/bookings',logger,verifyToken, async (req, res) => {
      console.log(req.query.email);
      console.log('token owner info',req.user);

      if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'forbidden access'})
      }

      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result)
    })

    app.post('/bookings', async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking)
      res.send(result)
    })

    app.delete('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.deleteOne(query)
      res.send(result)
    })
    // booking update
    app.get('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await bookingCollection.findOne(query)
      res.send(result)
    })

    app.put('/bookings/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const update = req.body;
      const Update = {
        $set: {
          date: update.date
        }
      }
      const result = await bookingCollection.updateOne(filter, Update, options)
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hotel is running')
})

app.listen(port, () => {
  console.log(`Hotel room is running on port ${port}`);
})