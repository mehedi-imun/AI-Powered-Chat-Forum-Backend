import mongoose from "mongoose";
import env from "../config/env";
import { User } from "../modules/user/user.model";

const seedAdmin = async () => {
	try {
		await mongoose.connect(env.DATABASE_URL);
		console.log("✅ Connected to MongoDB");

		const existingAdmin = await User.findOne({
			email: "admin@chatforum.com",
		});

		if (existingAdmin) {
			console.log("⚠️  Super Admin already exists!");
			console.log("📧 Email:", existingAdmin.email);
			console.log("🔑 Password: Admin@1234");
			console.log("👤 Role:", existingAdmin.role);
			await mongoose.disconnect();
			return;
		}

		const admin = await User.create({
			name: "Super Admin",
			email: "admin@chatforum.com",
			password: "Admin@1234",
			role: "Admin",
			emailVerified: true,
			bio: "Super Administrator - Full system access",
			avatar:
				"https://ui-avatars.com/api/?name=Super+Admin&background=4F46E5&color=fff&size=200",
		});

		console.log("\n🎉 Super Admin created successfully!");
		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
		console.log("📧 Email:    admin@chatforum.com");
		console.log("🔑 Password: Admin@1234");
		console.log("👤 Role:     Admin");
		console.log(`🆔 User ID:  ${admin._id}`);
		console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
		console.log("✅ You can now login with these credentials!");

		await mongoose.disconnect();
		console.log("✅ Disconnected from MongoDB");
		process.exit(0);
	} catch (error) {
		console.error("❌ Error seeding admin:", error);
		process.exit(1);
	}
};

seedAdmin();
