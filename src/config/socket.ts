import logger from "../utils/logger";
import type { Server as HTTPServer } from "node:http";
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

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication token missing"));
      }

      const decoded = verifyAccessToken(token);
      (socket as any).userId = decoded.userId;
      (socket as any).userRole = decoded.role;

      next();
    } catch (_error) {
      next(new Error("Authentication failed"));
    }
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    logger.info(`✅ Socket connected: ${socket.id} (User: ${userId})`);

    socket.join(`user:${userId}`);

    socket.on("thread:join", (threadId: string) => {
      socket.join(`thread:${threadId}`);
      logger.info(`👤 User ${userId} joined thread: ${threadId}`);
      socket.to(`thread:${threadId}`).emit("user:joined", {
        userId,
        threadId,
        timestamp: new Date(),
      });
    });

    socket.on("thread:leave", (threadId: string) => {
      socket.leave(`thread:${threadId}`);
      logger.info(`👤 User ${userId} left thread: ${threadId}`);
      socket.to(`thread:${threadId}`).emit("user:left", {
        userId,
        threadId,
        timestamp: new Date(),
      });
    });

    socket.on(
      "thread:typing",
      (data: { threadId: string; isTyping: boolean }) => {
        socket.to(`thread:${data.threadId}`).emit("user:typing", {
          userId,
          threadId: data.threadId,
          isTyping: data.isTyping,
          timestamp: new Date(),
        });
      }
    );

    socket.on("disconnect", () => {
      logger.info(`❌ Socket disconnected: ${socket.id} (User: ${userId})`);
    });

    socket.on("error", (error) => {
      logger.error(`Socket error for user ${userId}: ${error}`);
    });
  });

  logger.info("✅ Socket.IO server initialized");
  return io;
};

export const getSocketIO = (): SocketIOServer | null => {
  return io;
};

export const getIO = getSocketIO;

export const emitToThread = (threadId: string, event: string, data: any) => {
  if (io) {
    io.to(`thread:${threadId}`).emit(event, data);
  }
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};

export const emitToAll = (event: string, data: any) => {
  if (io) {
    io.emit(event, data);
  }
};

export const getOnlineUsersCount = (): number => {
  return io?.sockets.sockets.size || 0;
};

export const getUsersInThread = async (
  threadId: string
): Promise<Set<string>> => {
  if (!io) return new Set();
  const sockets = await io.in(`thread:${threadId}`).fetchSockets();
  return new Set(sockets.map((s) => s.id));
};
