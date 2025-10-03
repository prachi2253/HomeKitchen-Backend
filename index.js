const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
// This is your test secret API key For Stripe.step::1
const stripe = require("stripe")(process.env.SECRET_PAYMENT_GATEWAY_KEY);
const moment = require('moment-timezone');
const port = process.env.PORT || 5000;


// middleware 
app.use(cors({
  origin: "https://home-kitchen-frontend.vercel.app", // frontend origin
  credentials: true
}));
app.use(express.json());

// JWT ServerSite::Step=2 create a verify function  
const verifyJWTToken = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unauthorized access" });
    };
    // IN genaral we will get token from client site as 'bearer token' 
    // * so we split here the authorization which we take from client site headers
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, (error, decoded) => {
        if (error) {
            return res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@homekitchencluster.c7q8rlf.mongodb.net/HomeKitchenDB?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
    tls: true,
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Database Collections 
    const usersCollection = client.db('Homekitchendb').collection("users");
    const MenuCollection = client.db('Homekitchendb').collection("menu");
    // console.log(MenuCollection);
    const ReviewCollection = client.db('Homekitchendb').collection('reviews');
    const CartCollecttion = client.db('Homekitchendb').collection('carts');
    const OrderCollecttion = client.db('Homekitchendb').collection('orders');
    const BookingCollecttion = client.db('Homekitchendb').collection('bookings');
    const ComplaintsCollection = client.db('Homekitchendb').collection('complaints');


        // To Verify Admin MiddleWare        
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            next();
        }

        // Complaints API
        // POST: Add a new complaint/message
        app.post('/complaints', async (req, res) => {
            const complaint = req.body;
            complaint.createdAt = new Date();
            const result = await ComplaintsCollection.insertOne(complaint);
            res.send(result);
        });

        // GET: Get all complaints/messages (admin only)
        app.get('/complaints', verifyJWTToken, verifyAdmin, async (req, res) => {
            const complaints = await ComplaintsCollection.find().sort({ createdAt: -1 }).toArray();
            res.send(complaints);
        });


        // JWT Serversite::STEP=1 At First npm install jwt then require jwt then start from here 
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: "10h" })
            res.send({ token });
        })

        // User Handle API start Here 
        app.get('/users', verifyJWTToken, verifyAdmin, async (req, res) => {
            let query = {};
            const searchQuery = req.query?.search;
            if (req.query?.search) {
                query = { email: { $regex: searchQuery, $options: 'i' } }
            }
            const cursor = usersCollection.find(query);
            const result = await cursor.toArray();
            res.send(result);
        });

        // Check a User if he/she Admin or Not 
        app.get('/users/:email', verifyJWTToken, async (req, res) => {
            const email = req.params?.email;
            
            if (req.decoded.email !== email) {
                // return res.status(403).send({error: true, message: "unauthorized access"}) 
                // or 
                return res.send({ admin: false });
            }

            query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role == 'admin' };
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const isExistingUser = await usersCollection.findOne(query);
            if (isExistingUser) {
                return res.send({ message: 'User Already Exist on User List!' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        // Set A User As Admin API
        app.patch('/users/:id', verifyJWTToken, verifyAdmin, async (req, res) => {
            const id = req.params?.id;
            const filter = { _id: new ObjectId(id) };
            const updatedInfo = req.body;
            const updatedData = {
                $set: {
                    role: updatedInfo.role
                }
            };
            const result = await usersCollection.updateOne(filter, updatedData);
            res.send(result);
        });

        app.delete('/users/:id', verifyJWTToken, verifyAdmin, async (req, res) => {
            const id = req.params?.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })


        // Menu Handle API Here 
        app.get('/menu', async (req, res) => {
            const cursor = MenuCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post('/menu', verifyJWTToken, verifyAdmin, async (req, res) => {
            const menuItem = req.body;
            const result = await MenuCollection.insertOne(menuItem);
            res.send(result);
        });

        app.put('/menu/:id', verifyJWTToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const getUpdatedDocument = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateDB = {
                $set: {
                    name: getUpdatedDocument.name,
                    image: getUpdatedDocument.image,
                    recipe: getUpdatedDocument.recipe,
                    category: getUpdatedDocument.category,
                    price: getUpdatedDocument.price
                }
            }
            const result = MenuCollection.updateOne(filter, updateDB, options);
            res.send(result);
        })

        app.delete('/menu/:id', verifyJWTToken, verifyAdmin, async (req, res) => {
            const id = req.params?.id;
            const query = { _id: new ObjectId(id) };
            const result = await MenuCollection.deleteOne(query);
            res.send(result);
        });


        // Customer Review Handle API here 
        app.get('/reviews', async (req, res) => {
            const cursor = ReviewCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        app.post('/reviews', verifyJWTToken, async (req, res) => {
            const review = req.body;
            const result = await ReviewCollection.insertOne(review);
            res.send(result);
        })


        // JWT Serversite:STEP=3 use verifyJWTToken to those API's, you want to secure

        // handle Cart Items API down from here
        app.get('/carts', verifyJWTToken, async (req, res) => {
            let query = {};
            const email = req.query?.email;
            //JWT Serversite::STEP=4 check the token bearer and the user who requested for are the same 
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            if (req.query?.email) {
                query = { email: email };
            }
            const cursor = CartCollecttion.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.post('/carts', async (req, res) => {
            const cart = req.body;
            const result = await CartCollecttion.insertOne(cart);
            res.send(result);
        });

        app.delete('/carts/:id', verifyJWTToken, async (req, res) => {
            const id = req.params?.id;
            const query = { _id: new ObjectId(id) };
            const result = await CartCollecttion.deleteOne(query);
            res.send(result);
        });


        // Booking API Handle Here 
        app.get('/bookings', verifyJWTToken, async (req, res) => {
            let query = {};
            const email = req.query?.email;
            const decodedMail = req.decoded.email;
            if (email !== decodedMail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            if (email) {
                const user = await usersCollection.findOne({ email: email });
                if (user.role == 'admin') {
                    const result = await BookingCollecttion.find().toArray();
                    return res.send(result);
                }
                else {
                    query = { email: email };
                    const cursor = BookingCollecttion.find(query);
                    const result = await cursor.toArray();
                    res.send(result);
                }
            }

        })

        app.post('/bookings', verifyJWTToken, async (req, res) => {
            const bookingData = req.body;

            // Fixing date format using moment timezone 
            const clientDateString = bookingData.time;
            const clientDateObject = new Date(clientDateString);
            const desiredTimeZone = 'Asia/Kolkata';
            const convertedDate = moment(clientDateObject).tz(desiredTimeZone).format('ddd MMM DD YYYY HH:mm:ss');

            bookingData.time = convertedDate;

            const result = await BookingCollecttion.insertOne(bookingData);
            res.send(result);
        });

        app.patch('/bookings/:id', verifyJWTToken, verifyAdmin, async (req, res) => {
            const getUpdateData = req.body;
            const id = req.params?.id;
            const filter = { _id: new ObjectId(id) };
            const updateToDB = {
                $set: {
                    status: getUpdateData.status,
                }
            };
            const result = await BookingCollecttion.updateOne(filter, updateToDB);
            res.send(result);
        })

        // Create a PaymentIntent with the order amount and currency Stripe::2
        app.post("/create-payment-intent", verifyJWTToken, async (req, res) => {
            const { price } = req.body;

            // Stripe requires the smallest unit of currency
            // In INR, smallest unit = paise
            const totalAmount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: totalAmount,      // amount in paise
                currency: "inr",          // change to INR
                payment_method_types: ["card"],
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });


        // ORDERS or Payment Confirmed API Handle Here 

        app.get('/orders', verifyJWTToken, async (req, res) => {
            let query = {};
            const email = req.query?.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' });
            }
            if (email) {
                const user = await usersCollection.findOne({ email: email });
                if (user.role == 'admin') {
                    const result = await OrderCollecttion.find().toArray();
                    return res.send(result);
                }
                else {
                    query = { customerEmail: email };
                    const cursor = OrderCollecttion.find(query);
                    const result = await cursor.toArray();
                    res.send(result);
                }
            }
        })

        app.post('/orders', verifyJWTToken, async (req, res) => {
            const receivedOrder = req.body;
            // Destructer receivedOrder object and remove the CartItemId to store in orderList
            const { cartItemId, ...order } = receivedOrder;
            const orderResult = await OrderCollecttion.insertOne(order);
            const orderItem = receivedOrder?.cartItemId;
            const query = { _id: { $in: orderItem.map(id => new ObjectId(id)) } };
            const removeOrderItemFromCart = await CartCollecttion.deleteMany(query);
            res.send({ orderResult, removeOrderItemFromCart });
        });

        app.patch('/orders/:id', verifyJWTToken, verifyAdmin, async (req, res) => {
            const id = req.params?.id;
            const updateData = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDataInDB = {
                $set: {
                    orderStatus: updateData.status,
                }
            }
            const result = await OrderCollecttion.updateOne(filter, updateDataInDB);
            res.send(result);
        })

        // Administrative Data Transfer to Admin page 
        app.get('/adminData', verifyJWTToken, verifyAdmin, async (req, res) => {
            const totalOrder = await OrderCollecttion.estimatedDocumentCount();
            const totalItem = await MenuCollection.estimatedDocumentCount();
            const query = { role: { $ne: 'admin' } };
            const users = await usersCollection.find(query).toArray();
            const customer = users.length;
            res.send({ totalOrder, totalItem, customer });
        });

        // Get Statistical Data for Admin
        app.get('/order-stat-by-category', verifyJWTToken, verifyAdmin, async (req, res) => {
            const pipeline = [
                {
                    $unwind: '$foodItemId'
                },
                {
                    $lookup: {
                        from: 'menu',
                        let: { foodItemId: { $toObjectId: '$foodItemId' } },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$_id', '$$foodItemId'] } } }
                        ],
                        as: 'menuItem'
                    }
                },
                { $unwind: '$menuItem' },
                {
                    $group: {
                        _id: '$menuItem.category',
                        totalItemsSold: { $sum: 1 },
                        totalPrice: { $sum: '$menuItem.price' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        category: '$_id',
                        totalItemsSold: '$totalItemsSold',
                        totalSales: { $round: ['$totalPrice', 2] }
                    }
                }
            ];
            const result = await OrderCollecttion.aggregate(pipeline).toArray();
            res.send(result)
        });

        // Get Statistical Data for User 
        app.get('/order-summary', verifyJWTToken, async (req, res) => {
            const query = req.query?.email;
            const aggPipline = [
                { $match: { customerEmail: query } },
                { $unwind: '$foodItemId' },
                {
                    $lookup: {
                        from: 'menu',
                        let: { foodItemId: { $toObjectId: '$foodItemId' } },
                        pipeline: [
                            { $match: { $expr: { $eq: ['$_id', '$$foodItemId'] } } }
                        ],
                        as: 'menuItem'
                    }
                },
                { $unwind: '$menuItem' },
                {
                    $group: {
                        _id: '$menuItem.category',
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        category: '$_id',
                        totalItems: '$count',
                    },
                },
            ];
            const result = await OrderCollecttion.aggregate(aggPipline).toArray();
            res.send(result);
        })


        // Get Stripe Balance 
        app.get('/getBalance', verifyJWTToken, verifyAdmin, (req, res) => {
            stripe.balance.retrieve()
                .then(balance => {
                    // Convert amounts to user-friendly format by dividing by 100
                    const convertedBalance = {
                        // available: balance.available.map(entry => ({
                        //     amount: entry.amount ,
                        //     currency: entry.currency
                        // })),
                        // pending: balance.pending.map(entry => ({
                        //     amount: entry.amount,
                        //     currency: entry.currency
                        // }))
                        available:balance.available[0],
                        pending:balance.pending[0]
                    };
                    res.send(convertedBalance);
                })
                .catch(error => {
                    res.status(500).send(error.message);
                });
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("HomeKitchen Restaurant Server is Running Successfull!");
});

app.listen(port, () => {
    console.log(`HomeKitchen Restaurant Running on Port ${port}`);
});
