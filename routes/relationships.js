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

async function inferRelationships(member1Id, member2Id, relationshipType) {
  try {
    if (relationshipType === "parent") {
      // If A is parent of B, then B is child of A
      await createOrUpdateRelationship(member2Id, member1Id, "child", "forward")

      // Get spouse of member1 and link them as parent too
      const spouse1 = await findSpouse(member1Id)
      if (spouse1) {
        await createOrUpdateRelationship(spouse1, member2Id, "parent", "forward")
        await createOrUpdateRelationship(member2Id, spouse1, "child", "forward")
      }

      const allDescendants = await findAllDescendants(member2Id)
      if (allDescendants.length > 0) {
        for (const descendant of allDescendants) {
          await createOrUpdateRelationship(member1Id, descendant, "grandparent", "forward")
          if (spouse1) {
            await createOrUpdateRelationship(spouse1, descendant, "grandparent", "forward")
          }
        }
      }
    } else if (relationshipType === "child") {
      // If A is child of B, then B is parent of A
      await createOrUpdateRelationship(member2Id, member1Id, "parent", "forward")

      // Get spouse of member2 and link them as parent too
      const spouse2 = await findSpouse(member2Id)
      if (spouse2) {
        await createOrUpdateRelationship(spouse2, member1Id, "parent", "forward")
        await createOrUpdateRelationship(member1Id, spouse2, "child", "forward")
      }

      const allAncestors = await findAllAncestors(member2Id)
      if (allAncestors.length > 0) {
        for (const ancestor of allAncestors) {
          await createOrUpdateRelationship(ancestor, member1Id, "grandparent", "forward")
        }
      }
    } else if (relationshipType === "spouse") {
      // Only link both as parents to their EXISTING shared children (if any)
      const member1Children = await findAllChildren(member1Id)
      const member2Children = await findAllChildren(member2Id)

      // Link all of member1's children to member2 as parent
      for (const child of member1Children) {
        await createOrUpdateRelationship(member2Id, child, "parent", "forward")
        await createOrUpdateRelationship(child, member2Id, "child", "forward")
      }

      // Link all of member2's children to member1 as parent
      for (const child of member2Children) {
        await createOrUpdateRelationship(member1Id, child, "parent", "forward")
        await createOrUpdateRelationship(child, member1Id, "child", "forward")
      }

      // Spouses come from different families and should keep their own family lines
    } else if (relationshipType === "sibling") {
      const member2Parents = await findAllAncestors(member2Id)
      if (member2Parents.length > 0) {
        for (const parent of member2Parents) {
          await createOrUpdateRelationship(parent, member1Id, "parent", "forward")
          await createOrUpdateRelationship(member1Id, parent, "child", "forward")
        }
      }

      const member1Parents = await findAllAncestors(member1Id)
      if (member1Parents.length > 0) {
        for (const parent of member1Parents) {
          await createOrUpdateRelationship(parent, member2Id, "parent", "forward")
          await createOrUpdateRelationship(member2Id, parent, "child", "forward")
        }
      }

      const member2Descendants = await findAllDescendants(member2Id)
      if (member2Descendants.length > 0) {
        for (const descendant of member2Descendants) {
          await createOrUpdateRelationship(member1Id, descendant, "parent", "forward")
          await createOrUpdateRelationship(descendant, member1Id, "child", "forward")
        }
      }

      const member1Descendants = await findAllDescendants(member1Id)
      if (member1Descendants.length > 0) {
        for (const descendant of member1Descendants) {
          await createOrUpdateRelationship(member2Id, descendant, "parent", "forward")
          await createOrUpdateRelationship(descendant, member2Id, "child", "forward")
        }
      }
    }
  } catch (error) {
    console.log("Error inferring relationships:", error.message)
  }
}

async function findSpouse(memberId) {
  try {
    const spouseRel = await Relationship.findOne({
      $or: [
        { member1Id: memberId, relationshipType: "spouse" },
        { member2Id: memberId, relationshipType: "spouse" },
      ],
    })

    if (spouseRel) {
      return spouseRel.member1Id.toString() === memberId.toString() ? spouseRel.member2Id : spouseRel.member1Id
    }
    return null
  } catch (error) {
    console.log("Error finding spouse:", error.message)
    return null
  }
}

async function findAllDescendants(memberId, visited = new Set()) {
  try {
    if (visited.has(memberId.toString())) return []
    visited.add(memberId.toString())

    const descendants = []

    // Find direct children
    const children = await Relationship.find({
      member1Id: memberId,
      relationshipType: "parent",
    }).select("member2Id")

    for (const childRel of children) {
      const childId = childRel.member2Id
      descendants.push(childId)

      // Recursively find grandchildren
      const grandChildren = await findAllDescendants(childId, visited)
      descendants.push(...grandChildren)
    }

    return descendants
  } catch (error) {
    console.log("Error finding descendants:", error.message)
    return []
  }
}

async function findAllAncestors(memberId, visited = new Set()) {
  try {
    if (visited.has(memberId.toString())) return []
    visited.add(memberId.toString())

    const ancestors = []

    // Find direct parents
    const parents = await Relationship.find({
      member2Id: memberId,
      relationshipType: "parent",
    }).select("member1Id")

    for (const parentRel of parents) {
      const parentId = parentRel.member1Id
      ancestors.push(parentId)

      // Recursively find grandparents
      const grandParents = await findAllAncestors(parentId, visited)
      ancestors.push(...grandParents)
    }

    return ancestors
  } catch (error) {
    console.log("Error finding ancestors:", error.message)
    return []
  }
}

async function findAllChildren(memberId) {
  try {
    const children = await Relationship.find({
      member1Id: memberId,
      relationshipType: "parent",
    }).select("member2Id")

    return children.map((rel) => rel.member2Id)
  } catch (error) {
    console.log("Error finding children:", error.message)
    return []
  }
}

async function createOrUpdateRelationship(m1, m2, type, direction) {
  try {
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
  } catch (error) {
    console.log("Error creating relationship:", error.message)
  }
}

export default router
