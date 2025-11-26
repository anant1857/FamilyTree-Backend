import mongoose from "mongoose"

const relationshipSchema = new mongoose.Schema({
  member1Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  member2Id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Member",
    required: true,
  },
  relationshipType: {
    type: String,
    enum: ["parent", "child", "spouse", "sibling"],
    required: true,
  },
  direction: {
    type: String,
    enum: ["forward", "bidirectional"],
    default: "bidirectional",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

export default mongoose.model("Relationship", relationshipSchema)
