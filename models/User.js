// models/User.js

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "user"], default: "user" }, // Default to 'user'
});

module.exports = mongoose.model("User", userSchema);
