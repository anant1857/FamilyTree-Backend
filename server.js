import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import mongoose from "mongoose"
import authRoutes from "./routes/auth.js"
import memberRoutes from "./routes/members.js"
import relationshipRoutes from "./routes/relationships.js"

dotenv.config()

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/family-tree")
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error:", err))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/members", memberRoutes)
app.use("/api/relationships", relationshipRoutes)

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running" })
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
