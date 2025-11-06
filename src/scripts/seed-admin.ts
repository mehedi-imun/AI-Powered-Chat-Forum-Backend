import mongoose from "mongoose";
import env from "../config/env";
import logger from "../utils/logger";
import { User } from "../modules/user/user.model";

const seedAdmin = async () => {
  try {
    await mongoose.connect(env.DATABASE_URL);
    logger.info(" Connected to MongoDB");

    const existingAdmin = await User.findOne({
      email: "admin@chatforum.com",
    });

    if (existingAdmin) {
      logger.info("  Super Admin already exists!");
      logger.info(` Email: ${existingAdmin.email}`);
      logger.info(" Password: Admin@1234");
      logger.info(` Role: ${existingAdmin.role}`);
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

    logger.info("\n Super Admin created successfully!");
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info(" Email:    admin@chatforum.com");
    logger.info(" Password: Admin@1234");
    logger.info(" Role:     Admin");
    logger.info(` User ID:  ${admin._id}`);
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    logger.info(" You can now login with these credentials!");

    await mongoose.disconnect();
    logger.info(" Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    logger.error(` Error seeding admin: ${error}`);
    process.exit(1);
  }
};

seedAdmin();
