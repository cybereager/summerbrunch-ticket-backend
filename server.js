require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const csvParser = require("csv-parser");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

// Import the User model
const User = require("./models/User");

const app = express();
const PORT = process.env.PORT || 5500;

// Import cron.js (if needed)
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

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const chunkDir = path.join(__dirname, "uploads", "chunks");
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }
    cb(null, chunkDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Keep original chunk filename
  },
});

const upload = multer({ storage });

// Handle CSV chunk upload
app.post("/upload", upload.single("csv"), (req, res) => {
  const chunkFilePath = req.file.path;
  const fileName = req.file.originalname;

  // Save chunk to server and return a response once received
  console.log(`Received chunk: ${fileName}`);
  res.status(200).json({ message: "Chunk uploaded successfully" });
});

// Combine chunks and import tickets
app.post("/import-chunks", async (req, res) => {
  const chunkDir = path.join(__dirname, "uploads", "chunks");
  const combinedFilePath = path.join(__dirname, "uploads", "combined.csv");

  // Get all chunk files in the directory
  const chunkFiles = fs.readdirSync(chunkDir).filter((file) => file.endsWith(".csv"));
  
  if (chunkFiles.length === 0) {
    return res.status(400).json({ message: "No chunks to combine" });
  }

  // Combine all chunks into a single CSV file
  const combinedStream = fs.createWriteStream(combinedFilePath);
  for (const chunkFile of chunkFiles) {
    const chunkPath = path.join(chunkDir, chunkFile);
    const chunkStream = fs.createReadStream(chunkPath);
    chunkStream.pipe(combinedStream, { end: false });

    // Wait until current chunk is fully piped before processing next
    await new Promise((resolve) => chunkStream.on("end", resolve));
    fs.unlinkSync(chunkPath); // Clean up the chunk after processing
  }
  
  combinedStream.end();

  // Parse the combined CSV file
  const tickets = [];
  fs.createReadStream(combinedFilePath)
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
        fs.unlink(combinedFilePath, (err) => {
          if (err) {
            console.error("Error deleting the combined file:", err);
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
