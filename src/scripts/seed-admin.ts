import mongoose from "mongoose";
import { User } from "../modules/user/user.model";
import env from "../config/env";

/**
 * Seed Super Admin User
 * Run: npm run seed:admin
 */

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.DATABASE_URL);
    console.log("✅ Connected to MongoDB");

    // Check if admin already exists
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

    // Create Super Admin
    const admin = await User.create({
      name: "Super Admin",
      email: "admin@chatforum.com",
      password: "Admin@1234", // Will be hashed by pre-save hook
      role: "Admin",
      emailVerified: true,
      bio: "Super Administrator - Full system access",
      avatar: "https://ui-avatars.com/api/?name=Super+Admin&background=4F46E5&color=fff&size=200",
    });

    console.log("\n🎉 Super Admin created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:    admin@chatforum.com");
    console.log("🔑 Password: Admin@1234");
    console.log("👤 Role:     Admin");
    console.log("🆔 User ID:  " + admin._id);
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

// Run the seed function
seedAdmin();
