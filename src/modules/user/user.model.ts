import bcrypt from "bcryptjs";
import { model, Schema } from "mongoose";
import type { IUser } from "./user.interface";

const userSchema = new Schema<IUser>(
	{
		name: {
			type: String,
			required: [true, "Name is required"],
			trim: true,
			minlength: [2, "Name must be at least 2 characters"],
			maxlength: [50, "Name cannot exceed 50 characters"],
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			lowercase: true,
			trim: true,
			match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
			index: true,
		},
		password: {
			type: String,
			required: [true, "Password is required"],
			minlength: [6, "Password must be at least 6 characters"],
			select: false,
		},
		role: {
			type: String,
			enum: ["Admin", "Moderator", "Member"],
			default: "Member",
			index: true,
		},
		avatar: {
			type: String,
			default: null,
		},
		bio: {
			type: String,
			maxlength: [500, "Bio cannot exceed 500 characters"],
		},
		isActive: {
			type: Boolean,
			default: true,
			index: true,
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
		passwordResetToken: {
			type: String,
			select: false,
		},
		passwordResetExpires: {
			type: Date,
			select: false,
		},
		lastLoginAt: {
			type: Date,
		},
	},
	{
		timestamps: true,
		toJSON: {
			transform: (_doc, ret) => {
				const { password, __v, ...rest } = ret;
				return rest;
			},
		},
	},
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });

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

userSchema.methods.comparePassword = async function (
	candidatePassword: string,
): Promise<boolean> {
	try {
		return await bcrypt.compare(candidatePassword, this.password);
	} catch (error) {
		return false;
	}
};

export const User = model<IUser>("User", userSchema);
