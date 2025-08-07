const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "enter your username"],
    },
    profilePicture: {
      type: String,
    },
    email: {
      type: String,
      required: [true, "enter your email"],
      lowercase: true,
      unique: true,
      validate: [validator.isEmail, "your email is not valid"],
    },
    password: {
      type: String,
      required: true,
      minlength: [8, "the minimum length of password is 8"],
      select: false,
    },
    confirmPassword: {
      type: String,
      required: [true, "confirm your password"],
      validate: [
        function (value) {
          return this.password === value;
        },
        "password is not match",
      ],
    },
    role: {
      type: String,
      default: "user",
      enum: ["user", "admin", "visitor"],
    },
    isActive: {
      type: Boolean,
      default: true,
      select: false,
    },
    isVerified: { type: Boolean, default: false },
    passwordResetToken: String,
    passwordResetTokenExpires: String,
    passwordChangedAt: Date,
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (this.isModified(this.password)) next();
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(this.password, salt);
  this.password = hashedPassword;
  this.confirmPassword = undefined;
  next();
});

userSchema.methods.isCorrectPassword = function (password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
};

module.exports = new mongoose.model("User", userSchema);
