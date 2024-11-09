const { error } = require("console");
require('dotenv').config();
const mongoose = require("mongoose");
const express = require("express");
const { url } = require("inspector");
var app = express();
const uri = process.env.MONGODB_URI;

async function connect() {
    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error(error);
    }
}

connect();

const loginschema = new mongoose.Schema({
    googleId:{
     type:String,
     required: true
    },
    displayName: {
        type: String,
        required: true
    },
    fristyName: {
        type: String,
        required: true
    },
  
    profileImage: {
        type: String,
        required: true
    },
    socketii:{
        type: String,
        default:"hanirotvgfdes"
    },
   

    coin:{
        type:Number,
        default:0
    },
   
   chapatxref:{
    type: String,
    default:"itismychapatxref"
   },
   
});

const collection = mongoose.model("users", loginschema);

module.exports = collection;