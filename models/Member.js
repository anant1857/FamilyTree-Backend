import mongoose from "mongoose"

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
    required: true,
  },
  birthDate: Date,
  deathDate: Date,
  bio: String,
  occupation: String,
  contactInfo: {
    email: String,
    phone: String,
  },
  photo: String,
  generation: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
})

export default mongoose.model("Member", memberSchema)
