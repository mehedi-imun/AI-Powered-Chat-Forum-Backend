import type { Server as HTTPServer } from "http";
import { type Socket, Server as SocketIOServer } from "socket.io";
import { verifyAccessToken } from "../utils/jwt";
import env from "./env";

let io: SocketIOServer | null = null;

export const initializeSocketIO = (httpServer: HTTPServer): SocketIOServer => {
	io = new SocketIOServer(httpServer, {
		cors: {
			origin: env.FRONTEND_URL,
			credentials: true,
			methods: ["GET", "POST"],
		},
		pingTimeout: 60000,
		pingInterval: 25000,
	});

	// Authentication middleware
	io.use(async (socket, next) => {
		try {
			const token = socket.handshake.auth.token;

			if (!token) {
				return next(new Error("Authentication token missing"));
			}

			// Verify JWT token
			const decoded = verifyAccessToken(token);
			(socket as any).userId = decoded.userId;
			(socket as any).userRole = decoded.role;

			next();
		} catch (error) {
			next(new Error("Authentication failed"));
		}
	});

	// Connection handler
	io.on("connection", (socket: Socket) => {
		const userId = (socket as any).userId;
		console.log(`✅ Socket connected: ${socket.id} (User: ${userId})`);

		// Join user's personal room (for direct notifications)
		socket.join(`user:${userId}`);

		// Handle thread join
		socket.on("thread:join", (threadId: string) => {
			socket.join(`thread:${threadId}`);
			console.log(`👤 User ${userId} joined thread: ${threadId}`);
			socket.to(`thread:${threadId}`).emit("user:joined", {
				userId,
				threadId,
				timestamp: new Date(),
			});
		});

		// Handle thread leave
		socket.on("thread:leave", (threadId: string) => {
			socket.leave(`thread:${threadId}`);
			console.log(`👤 User ${userId} left thread: ${threadId}`);
			socket.to(`thread:${threadId}`).emit("user:left", {
				userId,
				threadId,
				timestamp: new Date(),
			});
		});

		// Handle typing indicator
		socket.on(
			"thread:typing",
			(data: { threadId: string; isTyping: boolean }) => {
				socket.to(`thread:${data.threadId}`).emit("user:typing", {
					userId,
					threadId: data.threadId,
					isTyping: data.isTyping,
					timestamp: new Date(),
				});
			},
		);

		// Handle disconnect
		socket.on("disconnect", () => {
			console.log(`❌ Socket disconnected: ${socket.id} (User: ${userId})`);
		});

		// Handle errors
		socket.on("error", (error) => {
			console.error(`Socket error for user ${userId}:`, error);
		});
	});

	console.log("✅ Socket.IO server initialized");
	return io;
};

export const getSocketIO = (): SocketIOServer | null => {
	return io;
};

// Alias for convenience
export const getIO = getSocketIO;

// Utility functions to emit events

/**
 * Emit event to a specific thread
 */
export const emitToThread = (threadId: string, event: string, data: any) => {
	if (io) {
		io.to(`thread:${threadId}`).emit(event, data);
	}
};

/**
 * Emit event to a specific user
 */
export const emitToUser = (userId: string, event: string, data: any) => {
	if (io) {
		io.to(`user:${userId}`).emit(event, data);
	}
};

/**
 * Emit event to all connected clients
 */
export const emitToAll = (event: string, data: any) => {
	if (io) {
		io.emit(event, data);
	}
};

/**
 * Get online users count
 */
export const getOnlineUsersCount = (): number => {
	return io?.sockets.sockets.size || 0;
};

/**
 * Get users in a thread
 */
export const getUsersInThread = async (
	threadId: string,
): Promise<Set<string>> => {
	if (!io) return new Set();
	const sockets = await io.in(`thread:${threadId}`).fetchSockets();
	return new Set(sockets.map((s) => s.id));
};
