import nodemailer, { Transporter } from "nodemailer";
import env from "../config/env";

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
    });

    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log("✅ Email service ready");
    } catch (error: any) {
      console.warn("⚠️  Email service unavailable (check SMTP credentials)");
      console.error("Email error:", error?.message || error);
    }
  }

  /**
   * Send email verification
   */
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
      console.log(`📧 Verification email sent to ${to}`);
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
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
      console.log(`📧 Password reset email sent to ${to}`);
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw error;
    }
  }

  /**
   * Send notification email
   */
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
      console.log(`📧 Notification email sent to ${to}`);
    } catch (error) {
      console.error("Error sending notification email:", error);
      throw error;
    }
  }

  /**
   * Send mention notification
   */
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
              ${postContent.substring(0, 200)}${postContent.length > 200 ? "..." : ""}
            </blockquote>
            <a href="${threadLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Thread
            </a>
          </div>
        `,
      });
      console.log(`📧 Mention notification sent to ${to}`);
    } catch (error) {
      console.error("Error sending mention notification:", error);
      throw error;
    }
  }

  /**
   * Send reply notification
   */
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
              ${replyContent.substring(0, 200)}${replyContent.length > 200 ? "..." : ""}
            </blockquote>
            <a href="${threadLink}" style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              View Thread
            </a>
          </div>
        `,
      });
      console.log(`📧 Reply notification sent to ${to}`);
    } catch (error) {
      console.error("Error sending reply notification:", error);
      throw error;
    }
  }

  /**
   * Send moderation alert to admins
   */
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
            <h2 style="color: #DC2626;">⚠️ Content Flagged</h2>
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
      console.log(`📧 Moderation alert sent to ${to}`);
    } catch (error) {
      console.error("Error sending moderation alert:", error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
