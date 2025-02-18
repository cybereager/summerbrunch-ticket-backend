// server.js

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const csvParser = require("csv-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");

// Import the User model
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5500;

// Import cron.js
const cron = require("./cron"); // Adjust the path if necessary

// MongoDB setup
mongoose
  .connect(
    "mongodb+srv://rajdeepchaudhari:LBTKLA3foztwXkrD@cluster0.l8fqe.mongodb.net/ticketManagement",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("MongoDB connected successfully!");
  })
  .catch((err) => {
    console.log("MongoDB connection error:", err);
  });

// Ticket Schema
const TicketSchema = new mongoose.Schema({
  name: String,
  email: String,
  reference: String,
  barcode: String,
  table_no: Number,
});

const Ticket = mongoose.model("Ticket", TicketSchema);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads/" });

// Import Tickets from CSV file
app.post("/import", upload.single("file"), (req, res) => {
  const filePath = req.file.path;
  const tickets = [];

  fs.createReadStream(filePath)
    .pipe(csvParser())
    .on("data", (row) => {
      tickets.push({
        name: row.name,
        email: row.email,
        reference: row.reference,
        barcode: row.barcode,
        table_no: parseInt(row.table_no, 10),
      });
    })
    .on("end", async () => {
      try {
        await Ticket.insertMany(tickets);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error("Error deleting the file:", err);
          }
        });
        res.status(200).json({ message: "Tickets imported successfully!" });
      } catch (error) {
        res.status(500).json({ message: "Error importing tickets", error });
      }
    });
});

// CRUD Routes for Tickets
app.get("/tickets", async (req, res) => {
  try {
    const tickets = await Ticket.find();
    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({ message: "Error fetching tickets", error });
  }
});

app.post("/tickets", async (req, res) => {
  try {
    const ticket = new Ticket(req.body);
    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ message: "Error creating ticket", error });
  }
});

app.put("/tickets/:id", async (req, res) => {
  try {
    const ticket = await Ticket.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.status(200).json(ticket);
  } catch (error) {
    res.status(500).json({ message: "Error updating ticket", error });
  }
});

app.delete("/tickets/:id", async (req, res) => {
  try {
    await Ticket.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Ticket deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting ticket", error });
  }
});

app.get("/ticket/:barcode", async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ barcode: req.params.barcode });
    if (ticket) {
      res.status(200).json(ticket);
    } else {
      res.status(404).json({ message: "Ticket not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching ticket", error });
  }
});

// Routes for User API
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find(); // Fetch all users
    res.status(200).json(users); // Return users as JSON
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Route to fetch a single user by username
app.get("/api/users/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }); // Fetch user by username
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user); // Return user details
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
