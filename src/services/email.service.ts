import nodemailer, { type Transporter } from "nodemailer";
import env from "../config/env";
import logger from "../utils/logger";

class EmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    } as any);

    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info("Email service ready");
    } catch (error) {
      logger.warn("Email service unavailable (check SMTP credentials)");
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Email error");
    }
  }

  async sendEmailVerification(
    to: string,
    name: string,
    verificationUrl: string
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject: "Verify Your Email Address",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Chat Forum, ${name}!</h2>
            <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Verify Email
            </a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 14px;">${verificationUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This link will expire in 24 hours.</p>
                            </div>
        `,
      });
      logger.info(`Verification email sent to ${to}`);
    } catch (error) {
      logger.error("Error sending verification email");
      throw error;
    }
  }

  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    name: string
  ): Promise<void> {
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject: "Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>Hi ${name},</p>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Reset Password
            </a>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 14px;">${resetUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 30px;">This link will expire in 1 hour.</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        `,
      });
      logger.info(`Password reset email sent to ${to}`);
    } catch (error) {
      logger.error("Error sending password reset email");
      throw error;
    }
  }

  async sendNotificationEmail(
    to: string,
    subject: string,
    message: string,
    link?: string
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>${subject}</h2>
            <p>${message}</p>
            ${
              link
                ? `
              <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                View Details
              </a>
            `
                : ""
            }
          </div>
        `,
      });
      logger.info(`Notification email sent to ${to}`);
    } catch (error) {
      logger.error("Error sending notification email");
      throw error;
    }
  }

  async sendMentionNotification(
    to: string,
    mentionedBy: string,
    threadTitle: string,
    postContent: string,
    threadLink: string
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject: `${mentionedBy} mentioned you in "${threadTitle}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been mentioned!</h2>
            <p><strong>${mentionedBy}</strong> mentioned you in <strong>"${threadTitle}"</strong></p>
            <blockquote style="border-left: 4px solid #4F46E5; padding-left: 16px; margin: 20px 0; color: #666;">
              ${postContent.substring(0, 200)}${
          postContent.length > 200 ? "..." : ""
        }
            </blockquote>
            <a href="${threadLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Thread
            </a>
          </div>
        `,
      });
      logger.info(`Mention notification sent to ${to}`);
    } catch (error) {
      logger.error("Error sending mention notification");
      throw error;
    }
  }

  async sendReplyNotification(
    to: string,
    repliedBy: string,
    threadTitle: string,
    replyContent: string,
    threadLink: string
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject: `New reply in "${threadTitle}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>New Reply</h2>
            <p><strong>${repliedBy}</strong> replied to your post in <strong>"${threadTitle}"</strong></p>
            <blockquote style="border-left: 4px solid #4F46E5; padding-left: 16px; margin: 20px 0; color: #666;">
              ${replyContent.substring(0, 200)}${
          replyContent.length > 200 ? "..." : ""
        }
            </blockquote>
            <a href="${threadLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Thread
            </a>
          </div>
        `,
      });
      logger.info(`Reply notification sent to ${to}`);
    } catch (error) {
      logger.error("Error sending reply notification");
      throw error;
    }
  }

  async sendModerationAlert(
    to: string,
    postId: string,
    reason: string,
    content: string,
    adminLink: string
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject: "Content Flagged for Moderation",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #DC2626;">Content Flagged</h2>
            <p>A post has been flagged for moderation:</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p><strong>Post ID:</strong> ${postId}</p>
            <blockquote style="border-left: 4px solid #DC2626; padding-left: 16px; margin: 20px 0; color: #666;">
              ${content.substring(0, 200)}${content.length > 200 ? "..." : ""}
            </blockquote>
            <a href="${adminLink}" style="display: inline-block; padding: 12px 24px; background-color: #DC2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Review Content
            </a>
          </div>
        `,
      });
      logger.info(`Moderation alert sent to ${to}`);
    } catch (error) {
      logger.error("Error sending moderation alert");
      throw error;
    }
  }
}

export const emailService = new EmailService();
