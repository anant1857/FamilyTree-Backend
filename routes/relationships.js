import express from "express"
import Relationship from "../models/Relationship.js"
import Member from "../models/Member.js"
import { verifyToken, verifyAdmin } from "../middleware/auth.js"

const router = express.Router()

// Get all relationships
router.get("/", verifyToken, async (req, res) => {
  try {
    const relationships = await Relationship.find().populate("member1Id").populate("member2Id")
    res.json(relationships)
  } catch (error) {
    res.status(500).json({ message: "Error fetching relationships" })
  }
})

// Get relationships for a member
router.get("/member/:memberId", verifyToken, async (req, res) => {
  try {
    const relationships = await Relationship.find({
      $or: [{ member1Id: req.params.memberId }, { member2Id: req.params.memberId }],
    })
      .populate("member1Id")
      .populate("member2Id")

    res.json(relationships)
  } catch (error) {
    res.status(500).json({ message: "Error fetching relationships" })
  }
})

// Create relationship (Admin only)
router.post("/", verifyAdmin, async (req, res) => {
  try {
    const { member1Id, member2Id, relationshipType, direction } = req.body

    // Validate members exist
    const member1 = await Member.findById(member1Id)
    const member2 = await Member.findById(member2Id)

    if (!member1 || !member2) {
      return res.status(404).json({ message: "One or both members not found" })
    }

    const relationship = new Relationship({
      member1Id,
      member2Id,
      relationshipType,
      direction: direction || "bidirectional",
    })

    await relationship.save()

    // Auto-infer relationships (Smart Relationship Engine)
    await inferRelationships(member1Id, member2Id, relationshipType)

    res.status(201).json(relationship)
  } catch (error) {
    res.status(500).json({ message: "Error creating relationship", error: error.message })
  }
})

// Delete relationship (Admin only)
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    const relationship = await Relationship.findByIdAndDelete(req.params.id)
    if (!relationship) {
      return res.status(404).json({ message: "Relationship not found" })
    }
    res.json({ message: "Relationship deleted successfully" })
  } catch (error) {
    res.status(500).json({ message: "Error deleting relationship", error: error.message })
  }
})

// Smart Relationship Engine - Auto-infer relationships
async function inferRelationships(member1Id, member2Id, relationshipType) {
  try {
    if (relationshipType === "parent") {
      // If A is parent of B, then B is child of A
      await createOrUpdateRelationship(member2Id, member1Id, "child", "forward")
    } else if (relationshipType === "child") {
      // If A is child of B, then B is parent of A
      await createOrUpdateRelationship(member2Id, member1Id, "parent", "forward")
    }
  } catch (error) {
    console.log("Error inferring relationships:", error.message)
  }
}

async function createOrUpdateRelationship(m1, m2, type, direction) {
  const existing = await Relationship.findOne({
    member1Id: m1,
    member2Id: m2,
    relationshipType: type,
  })

  if (!existing) {
    const rel = new Relationship({
      member1Id: m1,
      member2Id: m2,
      relationshipType: type,
      direction,
    })
    await rel.save()
  }
}

export default router
