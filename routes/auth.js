import express from "express"
import jwt from "jsonwebtoken"
import User from "../models/User.js"
import { verifyToken, verifyAdmin } from "../middleware/auth.js"

const router = express.Router()

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" })
    }

    // Check if login credentials match admin env variables
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      // Check if admin user exists in DB, if not create it
      let adminUser = await User.findOne({ username: process.env.ADMIN_USERNAME })
      if (!adminUser) {
        adminUser = new User({
          username: process.env.ADMIN_USERNAME,
          password: process.env.ADMIN_PASSWORD,
          role: "admin",
        })
        await adminUser.save()
      }

      const token = jwt.sign(
        { userId: adminUser._id, role: "admin", username: process.env.ADMIN_USERNAME },
        process.env.JWT_SECRET,
        { expiresIn: "7d" },
      )

      const refreshToken = jwt.sign({ userId: adminUser._id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: "30d",
      })

      return res.json({
        token,
        refreshToken,
        user: { id: adminUser._id, username: process.env.ADMIN_USERNAME, role: "admin" },
      })
    }

    // For non-admin users, check database
    const user = await User.findOne({ username })
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const isPasswordValid = await user.comparePassword(password)
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" })
    }

    const token = jwt.sign({ userId: user._id, role: user.role, username: user.username }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    })

    const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "30d" })

    res.json({
      token,
      refreshToken,
      user: { id: user._id, username: user.username, role: user.role },
    })
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message })
  }
})

router.post("/create-viewer", verifyAdmin, async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" })
    }

    // Create new viewer user
    const newUser = new User({
      username,
      password,
      role: "viewer",
    })

    await newUser.save()

    res.status(201).json({
      message: "Viewer account created successfully",
      user: { id: newUser._id, username: newUser.username, role: "viewer" },
    })
  } catch (error) {
    res.status(500).json({ message: "Failed to create viewer", error: error.message })
  }
})

// Refresh Token
router.post("/refresh", (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token required" })
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)
    const newToken = jwt.sign({ userId: decoded.userId }, process.env.JWT_SECRET, { expiresIn: "7d" })

    res.json({ token: newToken })
  } catch (error) {
    res.status(401).json({ message: "Invalid refresh token" })
  }
})

// Get current user
router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
    res.json({ user: { id: user._id, username: user.username, role: user.role } })
  } catch (error) {
    res.status(500).json({ message: "Error fetching user" })
  }
})

export default router


