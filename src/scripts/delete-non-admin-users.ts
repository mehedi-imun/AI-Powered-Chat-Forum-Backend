import mongoose from "mongoose";
import env from "../config/env";
import { User } from "../modules/user/user.model";
import { Post } from "../modules/post/post.model";
import { Thread } from "../modules/thread/thread.model";
import { Notification } from "../modules/notification/notification.model";

const deleteNonAdminUsers = async () => {
	try {
		// Connect to MongoDB
		await mongoose.connect(env.DATABASE_URL);
		console.log("✅ Connected to MongoDB");

		// Find all non-admin users
		const nonAdminUsers = await User.find({
			role: { $ne: "Admin" },
		});

		console.log(`📊 Found ${nonAdminUsers.length} non-admin users to delete`);

		if (nonAdminUsers.length === 0) {
			console.log("✅ No non-admin users to delete");
			await mongoose.disconnect();
			return;
		}

		const userIds = nonAdminUsers.map((user) => user._id);

		// Delete all posts created by non-admin users
		const postsDeleted = await Post.deleteMany({
			author: { $in: userIds },
		});
		console.log(`🗑️  Deleted ${postsDeleted.deletedCount} posts`);

		// Delete all threads created by non-admin users
		const threadsDeleted = await Thread.deleteMany({
			createdBy: { $in: userIds },
		});
		console.log(`🗑️  Deleted ${threadsDeleted.deletedCount} threads`);

		// Delete all notifications for non-admin users
		const notificationsDeleted = await Notification.deleteMany({
			userId: { $in: userIds },
		});
		console.log(
			`🗑️  Deleted ${notificationsDeleted.deletedCount} notifications`,
		);

		// Delete the non-admin users
		const usersDeleted = await User.deleteMany({
			role: { $ne: "Admin" },
		});
		console.log(`🗑️  Deleted ${usersDeleted.deletedCount} users`);

		console.log("\n✅ Successfully deleted all non-admin users and their data");

		// Show remaining admin users
		const admins = await User.find({ role: "Admin" }).select("name email role");
		console.log("\n👥 Remaining Admin Users:");
		for (const admin of admins) {
			console.log(`   - ${admin.name} (${admin.email})`);
		}

		await mongoose.disconnect();
		console.log("\n✅ Disconnected from MongoDB");
	} catch (error) {
		console.error("❌ Error:", error);
		process.exit(1);
	}
};

// Run the script
deleteNonAdminUsers();
