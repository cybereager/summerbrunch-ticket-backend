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

// Multer setup for file upload
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // Max file size 10 MB
}).single("file");

// Helper function to insert tickets in batches
const insertTicketsInBatches = async (tickets) => {
  const batchSize = 100; // Batch size for insertion
  while (tickets.length > 0) {
    const batch = tickets.splice(0, batchSize);
    try {
      await Ticket.insertMany(batch);
    } catch (error) {
      console.error("Error inserting batch:", error);
      throw error; // If insert fails, stop processing further
    }
  }
};

// Import Tickets from CSV file
app.post("/import", upload, (req, res) => {
  const filePath = req.file.path;
  const tickets = [];

  // Parse the CSV file stream
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

      // Insert tickets in batches if the batch size is reached
      if (tickets.length >= 100) {
        insertTicketsInBatches(tickets)
          .then(() => {
            tickets.length = 0; // Reset the tickets array for the next batch
          })
          .catch((error) => {
            res.status(500).json({ message: "Error importing tickets", error });
            fs.unlink(filePath, (err) => {
              if (err) console.error("Error deleting the file:", err);
            });
          });
      }
    })
    .on("end", async () => {
      // Insert any remaining tickets if there are less than a batch of 100
      if (tickets.length > 0) {
        try {
          await insertTicketsInBatches(tickets);
          res.status(200).json({ message: "Tickets imported successfully!" });
        } catch (error) {
          res.status(500).json({ message: "Error importing tickets", error });
        }
      }

      // Clean up the uploaded file after processing
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting the file:", err);
      });
    })
    .on("error", (error) => {
      console.error("Error during CSV parsing:", error);
      res.status(500).json({ message: "Error parsing CSV file", error });
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting the file:", err);
      });
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
