import express from "express"
import Member from "../models/Member.js"
import Relationship from "../models/Relationship.js"
import { verifyToken, verifyAdmin } from "../middleware/auth.js"

const router = express.Router()

// Get all members
router.get("/", verifyToken, async (req, res) => {
  try {
    const members = await Member.find()
    res.json(members)
  } catch (error) {
    res.status(500).json({ message: "Error fetching members" })
  }
})

// Get member by ID
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id)
    if (!member) {
      return res.status(404).json({ message: "Member not found" })
    }
    res.json(member)
  } catch (error) {
    res.status(500).json({ message: "Error fetching member" })
  }
})

// Create member (Admin only)
router.post("/", verifyAdmin, async (req, res) => {
  try {
    const { name, gender, birthDate, deathDate, bio, occupation, contactInfo, photo, generation } = req.body

    const member = new Member({
      name,
      gender,
      birthDate,
      deathDate,
      bio,
      occupation,
      contactInfo,
      photo,
      generation,
    })

    await member.save()
    res.status(201).json(member)
  } catch (error) {
    res.status(500).json({ message: "Error creating member", error: error.message })
  }
})

// Update member (Admin only)
router.put("/:id", verifyAdmin, async (req, res) => {
  try {
    const { name, gender, birthDate, deathDate, bio, occupation, contactInfo, photo, generation } = req.body

    const member = await Member.findByIdAndUpdate(
      req.params.id,
      {
        name,
        gender,
        birthDate,
        deathDate,
        bio,
        occupation,
        contactInfo,
        photo,
        generation,
        updatedAt: new Date(),
      },
      { new: true },
    )

    if (!member) {
      return res.status(404).json({ message: "Member not found" })
    }

    res.json(member)
  } catch (error) {
    res.status(500).json({ message: "Error updating member", error: error.message })
  }
})

// Delete member (Admin only)
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    const member = await Member.findByIdAndDelete(req.params.id)
    if (!member) {
      return res.status(404).json({ message: "Member not found" })
    }

    // Delete all relationships involving this member
    await Relationship.deleteMany({
      $or: [{ member1Id: req.params.id }, { member2Id: req.params.id }],
    })

    res.json({ message: "Member deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Error deleting member", error: error.message })
  }
})

export default router
