import bcrypt from "bcryptjs";
import { Schema, model } from "mongoose";
import { IUser } from "./user.interface";

const userSchema = new Schema<IUser>(
  {
    organizationId: {
      type: String,
      required: false, // DEPRECATED: Kept for backward compatibility
    },
    organizationIds: {
      type: [String],
      default: [], // NEW: Support multiple organizations
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't return password by default
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    role: {
      type: String,
      enum: {
        values: ["SuperAdmin", "Admin", "OrgOwner", "OrgAdmin", "OrgMember"],
        message: "{VALUE} is not a valid role",
      },
      required: [true, "Role is required"],
      default: "OrgMember",
    },
    managedTeamIds: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending", "suspended"],
      default: "pending", // New users start as pending
    },
    lastLoginAt: {
      type: Date,
    },
    firstLogin: {
      type: Date,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpires: {
      type: Date,
      select: false,
    },
    invitedBy: {
      type: String, // User ID who invited this user
    },
    invitedAt: {
      type: Date,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    setupToken: {
      type: String,
      select: false,
    },
    setupTokenExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true, // Enable virtuals in JSON output
      transform: (_doc, ret) => {
        delete (ret as any).password;
        delete (ret as any).passwordResetToken;
        delete (ret as any).passwordResetExpires;
        delete (ret as any).__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true, // Enable virtuals in object output
    },
  }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Add indexes
userSchema.index({ organizationId: 1 }); // DEPRECATED: Kept for backward compatibility
userSchema.index({ organizationIds: 1 }); // NEW: Multi-organization index
userSchema.index({ email: 1, organizationIds: 1 }); // Compound index
userSchema.index({ role: 1, organizationIds: 1 }); // Role-based queries

export const User = model<IUser>("User", userSchema);
