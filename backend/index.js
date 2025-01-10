const fs = require("fs");
const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { JSONRPC_ERR_CHAIN_DISCONNECTED } = require("web3");
const { JsonWebTokenError } = require("jsonwebtoken");

app.use(express.json());
app.use(cors());

// Ensure the upload directory exists
const uploadDir = path.join(__dirname, 'upload/images');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Database Connection with MongoDB
mongoose.connect("mongodb+srv://{}")
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection error:", err));
// API Creation
app.get("/", (req, res) => {
    res.send("Express App is Running");
});

// Image Storage Engine
const storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
        cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage: storage });

// Creating Upload endpoint for images
app.use('/images', express.static(uploadDir));
app.post("/upload", upload.single('product'), (req, res) => {
    console.log("File:", req.file);  // Log req.file to see if it's undefined
    console.log("Body:", req.body);  // Log req.body to check if data is received

    if (!req.file) {
        return res.status(400).json({ success: 0, message: "No file uploaded" });
    }
    
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    });
});

// Schema for creating products
const Product = mongoose.model("Product", {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: { // Corrected typo here
        type: Boolean,
        default: true,
    },
});

app.post('/addproduct', async (req, res) => {
    let products = await Product.find({});
    let id;
    if (products.length>0){
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id + 1;

    }
    else{ id =1}
    try {
        const product = new Product({
            id: id,
            name: req.body.name,
            image: req.body.image,
            category: req.body.category,
            new_price: req.body.new_price,
            old_price: req.body.old_price,
        });
        
        console.log("Product to save:", product);
        await product.save();
        console.log("Product saved successfully");

        res.json({
            success: true,
            name: req.body.name,
        });
    } catch (error) {
        console.error("Error saving product:", error);
        res.status(500).json({ success: false, message: "Failed to add product" });
    }
});


//Creating API for deleting product

app.post('/removeproduct', async(req, res)=>
{
    await Product.findOneAndDelete({id:req.body.id});
    console.log("Remove");
    res.json({
        success: true,
        name: req.body.name
    })
} )

//Create API for getting all products
app.get('/allproducts', async(req, res)=>{
    let products = await Product.find({});
    console.log("All products fetched");
    res.send(products);
})

//schema creating for user model

const Users = mongoose.model('Users',{
    name: {
        type: String
    },

    email:{
        type: String,
        unique: true,
    },

    password:{
        type: String
    },

    cartData:{
        type: Object,
    },

    date: {
        type: Date,
        default: Date.now,
    }



})

//Creating endpoint for registering the user
const JsonWebToken = require('jsonwebtoken');
const { error } = require("console");
app.post('/signup', async(req, res) =>{

    try {
        let check = await Users.findOne({ email: req.body.email });
        if (check) {
          return res.status(400).json({ success: false, errors: "Email already in use." });
        }

    let cart = {};
    for(let i =0; i<300; i++){
        cart[i] = 0;

    }

    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart,
    })

    await user.save();

    const data = {
        user:{
            id: user.id
        }
    }

    const token = JsonWebToken.sign(data, 'secret_ecom');
    res.json({success: true, token});
}
catch (error) {
    console.error(error);
    res.status(500).json({ success: false, errors: "Internal Server Error" });
  }
    
});

//creating end point for user login

app.post('/login', async (req, res)=>{
let user = await Users.findOne({email:req.body.email});
if (user){
    const passCompare = req.body.password === user.password;
    if (passCompare){
        const data ={
            user: {
                id: user.id
            }
        }

        const token = JsonWebToken.sign(data, 'secret_ecom');
        res.json({success: true, token});
    }

    else{
        res.json({success: false, errors: "Wrong Password"});
    }
}

else{
    res.json({success: false, errors:"Wrong Email Id"});
}
})

//creating endpoint for new collection data
app.get("/newcollections", async(req,res)=>{
    let products = await Product.find({});
    let newcollection = products.slice(1).slice(-8);
    console.log("New Collection fetched");
    res.send(newcollection);
})

//creating endpoint for popular in women section
app.get("/popularinwomen", async(req,res)=>{
    let products = await Product.find({category:"women"});
    let popular_in_women = products.slice(0,4);
    console.log("Popular in women fetched");
    res.send(popular_in_women);
})

//creating endpoint for adding products in cartdata



//Creating middleware to fetch user
const fetchUser = async(req, res,  next)=>{
    const token = req.header("auth-token");
    if(!token){
        res.status(401).send({errors:"Please authenticate using valid token"});

    }
    else{
        try{
            const data = JsonWebToken.verify(token, "secret_ecom");
            req.user= data.user;
            next();
        }
        catch(error){
            res.status(401).send({errors:"Please Authenticate using a Valid Token"});
        }
    }
}



//creating endpoint for adding products in cartdata 
app.post("/addtocart",fetchUser, async (req,res)=>{
    // console.log(req.body, req.user);
    console.log("Added", req.body.itemId);
    let userData = await Users.findOne({_id: req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({_id: req.user.id}, {cartData: userData.cartData});
    res.send("Added");

})

//creating endpoint to remove product from cartdata
app.post("/removefromcart", fetchUser, async (req, res)=>{
    console.log("removed", req.body.itemId);
    let userData = await Users.findOne({_id: req.user.id});
    if( userData.cartData[req.body.itemId]>0){
    userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({_id: req.user.id}, {cartData: userData.cartData});
    res.send("Removed");}

})

//creating endpoint to get cartdata
app.post("/getcart", fetchUser,async (req,res)=>{
    console.log("GetCart");
    let userData = await Users.findOne({_id: req.user.id});
    res.json(userData.cartData);
})


app.listen(port, (err) => {
    if (!err) {
        console.log("Server running on port " + port);
    } else {
        console.log("Error starting server:", err);
    }
});
