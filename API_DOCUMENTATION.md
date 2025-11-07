# API Documentation - AI-Powered Chat Forum

## Table of Contents

1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Response Format](#response-format)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [Endpoints](#endpoints)
   - [Authentication](#authentication-endpoints)
   - [Users](#user-endpoints)
   - [Threads](#thread-endpoints)
   - [Posts](#post-endpoints)
   - [Notifications](#notification-endpoints)
   - [Admin](#admin-endpoints)
   - [Webhooks](#webhook-endpoints)

---

## Overview

This document provides comprehensive API documentation for the AI-Powered Chat Forum backend. The API follows RESTful principles and uses JSON for request and response bodies.

**API Version:** v1  
**Last Updated:** November 2025  
**Content-Type:** `application/json`

---

## Base URL

**Development:**

```
http://localhost:5000/api/v1
```

**Production:**

```
https://api.yourforum.com/api/v1
```

---

## Authentication

### JWT-Based Authentication

The API uses JSON Web Tokens (JWT) for authentication. After successful login or registration, you'll receive:

- **Access Token** (15 minutes validity)
- **Refresh Token** (7 days validity)

### Including Tokens in Requests

**Access Token (Required for protected endpoints):**

```
Authorization: Bearer <access_token>
```

**Refresh Token (For token refresh):**

```
Authorization: Bearer <refresh_token>
```

### Token Refresh Flow

When access token expires (401 Unauthorized):

1. Call `POST /auth/refresh-token` with refresh token
2. Receive new access token
3. Retry original request with new token

---

## Response Format

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success message",
  "data": {
    // Response data
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success message",
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error message",
  "errorSources": [
    {
      "path": "field_name",
      "message": "Field-specific error"
    }
  ],
  "stack": "Error stack (development only)"
}
```

### HTTP Status Codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| 200  | OK - Request successful                  |
| 201  | Created - Resource created successfully  |
| 400  | Bad Request - Invalid input              |
| 401  | Unauthorized - Authentication required   |
| 403  | Forbidden - Insufficient permissions     |
| 404  | Not Found - Resource not found           |
| 409  | Conflict - Duplicate resource            |
| 422  | Unprocessable Entity - Validation failed |
| 429  | Too Many Requests - Rate limit exceeded  |
| 500  | Internal Server Error - Server error     |

### Common Error Messages

**Authentication Errors:**

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

**Validation Errors:**

```json
{
  "success": false,
  "message": "Validation failed",
  "errorSources": [
    {
      "path": "email",
      "message": "Invalid email format"
    }
  ]
}
```

**Authorization Errors:**

```json
{
  "success": false,
  "message": "You do not have permission to perform this action"
}
```

---

## Rate Limiting

**Default Limits:**

- General endpoints: 100 requests per 15 minutes per IP
- Auth endpoints: 20 requests per 15 minutes per IP
- Admin endpoints: 200 requests per 15 minutes per IP

**Rate Limit Headers:**

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1635789600
```

**Rate Limit Exceeded Response:**

```json
{
  "success": false,
  "message": "Too many requests, please try again later"
}
```

---

## Endpoints

## Authentication Endpoints

### Register User

Create a new user account.

**Endpoint:** `POST /auth/register`  
**Authentication:** Not required

**Request Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "confirmPassword": "SecurePass123!"
}
```

**Validation Rules:**

- `name`: 3-50 characters
- `email`: Valid email, unique
- `password`: Min 6 characters, must match confirmPassword

**Success Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully. Please check your email to verify your account.",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "isVerified": false,
      "createdAt": "2025-11-07T10:00:00.000Z"
    }
  }
}
```

**Error Response (409):**

```json
{
  "success": false,
  "message": "Email already exists"
}
```

---

### Login

Authenticate a user and receive tokens.

**Endpoint:** `POST /auth/login`  
**Authentication:** Not required

**Request Body:**

```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "isVerified": true,
      "avatar": "https://example.com/avatar.jpg"
    }
  }
}
```

**Error Response (401):**

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

### Refresh Token

Get a new access token using refresh token.

**Endpoint:** `POST /auth/refresh-token`  
**Authentication:** Refresh token required

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### Verify Email

Verify user email address with token.

**Endpoint:** `POST /auth/verify-email?token=<verification_token>`  
**Authentication:** Not required

**Query Parameters:**

- `token` (required): Email verification token from email link

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Email verified successfully",
  "data": null
}
```

---

### Forgot Password

Request password reset email.

**Endpoint:** `POST /auth/forgot-password`  
**Authentication:** Not required

**Request Body:**

```json
{
  "email": "john@example.com"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password reset email sent successfully",
  "data": null
}
```

---

### Reset Password

Reset password with token from email.

**Endpoint:** `POST /auth/reset-password`  
**Authentication:** Not required

**Request Body:**

```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password reset successfully",
  "data": null
}
```

---

### Change Password

Change password for authenticated user.

**Endpoint:** `POST /auth/change-password`  
**Authentication:** Required

**Request Body:**

```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePass123!",
  "confirmPassword": "NewSecurePass123!"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Password changed successfully",
  "data": null
}
```

---

## User Endpoints

### Get All Users

Retrieve a list of users with pagination.

**Endpoint:** `GET /users`  
**Authentication:** Not required

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `search` (optional): Search by name or email
- `role` (optional): Filter by role (user, moderator, admin)

**Example Request:**

```
GET /users?page=1&limit=20&role=user&search=john
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Users retrieved successfully",
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "user",
        "avatar": "https://example.com/avatar.jpg",
        "isVerified": true,
        "createdAt": "2025-11-07T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

### Get Current User

Get authenticated user profile.

**Endpoint:** `GET /users/me`  
**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Current user retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user",
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Software developer passionate about coding",
    "isVerified": true,
    "isBanned": false,
    "createdAt": "2025-11-07T10:00:00.000Z"
  }
}
```

---

### Get User by ID

Get specific user profile by ID.

**Endpoint:** `GET /users/:id`  
**Authentication:** Not required

**Path Parameters:**

- `id` (required): User ID

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "avatar": "https://example.com/avatar.jpg",
    "bio": "Software developer",
    "role": "user",
    "createdAt": "2025-11-07T10:00:00.000Z"
  }
}
```

**Error Response (404):**

```json
{
  "success": false,
  "message": "User not found"
}
```

---

### Update User Profile

Update authenticated user's profile.

**Endpoint:** `PATCH /users/:id`  
**Authentication:** Required (own profile or admin)

**Request Body:**

```json
{
  "name": "John Smith",
  "bio": "Updated bio",
  "avatar": "https://example.com/new-avatar.jpg"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Smith",
    "email": "john@example.com",
    "bio": "Updated bio",
    "avatar": "https://example.com/new-avatar.jpg"
  }
}
```

---

### Delete User

Delete user account (soft delete).

**Endpoint:** `DELETE /users/:id`  
**Authentication:** Required (own account or admin)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User deleted successfully",
  "data": null
}
```

---

## Thread Endpoints

### Get All Threads

Retrieve list of threads with pagination and filters.

**Endpoint:** `GET /threads`  
**Authentication:** Not required

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status (active, locked, deleted)
- `sort` (optional): Sort field (createdAt, lastActivityAt, viewCount)
- `order` (optional): Sort order (asc, desc)
- `authorId` (optional): Filter by author ID
- `tags` (optional): Filter by tags (comma-separated)

**Example Request:**

```
GET /threads?page=1&limit=20&sort=lastActivityAt&order=desc&status=active
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Threads retrieved successfully",
  "data": {
    "threads": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "title": "How to use async/await in JavaScript?",
        "description": "I'm learning async programming...",
        "author": {
          "_id": "507f1f77bcf86cd799439012",
          "name": "John Doe",
          "avatar": "https://example.com/avatar.jpg"
        },
        "status": "active",
        "isPinned": false,
        "viewCount": 150,
        "postCount": 10,
        "tags": ["javascript", "async"],
        "lastActivityAt": "2025-11-07T12:00:00.000Z",
        "createdAt": "2025-11-07T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

---

### Get Thread by ID

Get specific thread with full details.

**Endpoint:** `GET /threads/:id`  
**Authentication:** Not required

**Path Parameters:**

- `id` (required): Thread ID

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Thread retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "How to use async/await in JavaScript?",
    "description": "I'm learning async programming and need help understanding async/await patterns.",
    "author": {
      "_id": "507f1f77bcf86cd799439012",
      "name": "John Doe",
      "avatar": "https://example.com/avatar.jpg"
    },
    "status": "active",
    "isPinned": false,
    "viewCount": 150,
    "postCount": 10,
    "tags": ["javascript", "async"],
    "summary": "Discussion about async/await patterns in JavaScript with examples.",
    "lastActivityAt": "2025-11-07T12:00:00.000Z",
    "createdAt": "2025-11-07T10:00:00.000Z"
  }
}
```

---

### Search Threads

Full-text search for threads.

**Endpoint:** `GET /threads/search`  
**Authentication:** Not required

**Query Parameters:**

- `q` (required): Search query
- `page` (optional): Page number
- `limit` (optional): Items per page

**Example Request:**

```
GET /threads/search?q=javascript async&page=1&limit=20
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Search results retrieved successfully",
  "data": {
    "threads": [...],
    "pagination": {...}
  }
}
```

---

### Get Thread by Slug

Get thread by URL slug.

**Endpoint:** `GET /threads/slug/:slug`  
**Authentication:** Not required

**Path Parameters:**

- `slug` (required): Thread slug

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Thread retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "How to use async/await in JavaScript?",
    "slug": "how-to-use-async-await-in-javascript",
    ...
  }
}
```

---

### Get Threads by User

Get all threads created by specific user.

**Endpoint:** `GET /threads/user/:userId`  
**Authentication:** Not required

**Path Parameters:**

- `userId` (required): User ID

**Query Parameters:**

- `page` (optional): Page number
- `limit` (optional): Items per page

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User threads retrieved successfully",
  "data": {
    "threads": [...],
    "pagination": {...}
  }
}
```

---

### Create Thread

Create a new discussion thread.

**Endpoint:** `POST /threads`  
**Authentication:** Required (Email verification required)

**Request Body:**

```json
{
  "title": "How to use async/await in JavaScript?",
  "description": "I'm learning async programming and need help understanding async/await patterns.",
  "tags": ["javascript", "async", "programming"]
}
```

**Validation Rules:**

- `title`: 5-200 characters, required
- `description`: 10-2000 characters, required
- `tags`: Array of strings (optional), max 5 tags

**Success Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Thread created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "How to use async/await in JavaScript?",
    "description": "I'm learning async programming...",
    "authorId": "507f1f77bcf86cd799439012",
    "status": "active",
    "slug": "how-to-use-async-await-in-javascript",
    "tags": ["javascript", "async", "programming"],
    "viewCount": 0,
    "postCount": 0,
    "createdAt": "2025-11-07T10:00:00.000Z"
  }
}
```

---

### Update Thread

Update thread details.

**Endpoint:** `PATCH /threads/:id`  
**Authentication:** Required (author or admin/moderator)

**Request Body:**

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "tags": ["javascript", "async"],
  "status": "active"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Thread updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "title": "Updated title",
    "description": "Updated description",
    ...
  }
}
```

---

### Delete Thread

Delete thread (soft delete).

**Endpoint:** `DELETE /threads/:id`  
**Authentication:** Required (author or admin/moderator)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Thread deleted successfully",
  "data": null
}
```

---

### Request Thread Summary

Request AI-generated thread summary.

**Endpoint:** `POST /threads/:id/summary`  
**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Summary generation requested. It will be available shortly.",
  "data": null
}
```

**Note:** Summary is generated asynchronously by AI worker.

---

### Get Thread Summary

Get AI-generated thread summary.

**Endpoint:** `GET /threads/:id/summary`  
**Authentication:** Not required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Thread summary retrieved successfully",
  "data": {
    "summary": "This thread discusses async/await patterns in JavaScript with practical examples and best practices."
  }
}
```

---

## Post Endpoints

### Get Posts by Thread

Get all posts in a thread.

**Endpoint:** `GET /posts/thread/:threadId`  
**Authentication:** Not required

**Path Parameters:**

- `threadId` (required): Thread ID

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `parentId` (optional): Filter by parent post (for replies)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Posts retrieved successfully",
  "data": {
    "posts": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "threadId": "507f1f77bcf86cd799439012",
        "author": {
          "_id": "507f1f77bcf86cd799439013",
          "name": "John Doe",
          "avatar": "https://example.com/avatar.jpg"
        },
        "content": "Great question! Here's how async/await works...",
        "parentId": null,
        "status": "active",
        "mentions": [],
        "votes": {
          "upvotes": 15,
          "downvotes": 2
        },
        "isEdited": false,
        "aiModeration": {
          "checked": true,
          "flagged": false
        },
        "createdAt": "2025-11-07T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 10,
      "totalPages": 1
    }
  }
}
```

---

### Get Posts by User

Get all posts created by specific user.

**Endpoint:** `GET /posts/user/:userId`  
**Authentication:** Not required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User posts retrieved successfully",
  "data": {
    "posts": [...],
    "pagination": {...}
  }
}
```

---

### Get Post by ID

Get specific post details.

**Endpoint:** `GET /posts/:id`  
**Authentication:** Not required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Post retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "threadId": "507f1f77bcf86cd799439012",
    "author": {...},
    "content": "Post content here",
    "parentId": null,
    "status": "active",
    "votes": {...},
    "createdAt": "2025-11-07T10:30:00.000Z"
  }
}
```

---

### Create Post

Create a new post or reply.

**Endpoint:** `POST /posts`  
**Authentication:** Required (Email verification required)

**Request Body:**

```json
{
  "threadId": "507f1f77bcf86cd799439012",
  "content": "Great question! Here's how async/await works...",
  "parentId": null,
  "mentions": ["507f1f77bcf86cd799439013"]
}
```

**Validation Rules:**

- `threadId`: Required, valid ObjectId
- `content`: 1-10000 characters, required
- `parentId`: Optional, valid ObjectId (for replies)
- `mentions`: Optional array of user IDs

**Success Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Post created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "threadId": "507f1f77bcf86cd799439012",
    "authorId": "507f1f77bcf86cd799439013",
    "content": "Great question! Here's how async/await works...",
    "parentId": null,
    "status": "active",
    "mentions": ["507f1f77bcf86cd799439013"],
    "votes": {
      "upvotes": 0,
      "downvotes": 0,
      "voters": []
    },
    "createdAt": "2025-11-07T10:30:00.000Z"
  }
}
```

**Note:** Post is automatically sent to AI moderation queue for content checking.

---

### Update Post

Update post content.

**Endpoint:** `PATCH /posts/:id`  
**Authentication:** Required (author or admin/moderator)

**Request Body:**

```json
{
  "content": "Updated post content..."
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Post updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "content": "Updated post content...",
    "isEdited": true,
    "editedAt": "2025-11-07T11:00:00.000Z"
  }
}
```

---

### Delete Post

Delete post (soft delete).

**Endpoint:** `DELETE /posts/:id`  
**Authentication:** Required (author or admin/moderator)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Post deleted successfully",
  "data": null
}
```

---

### Vote on Post

Upvote or downvote a post.

**Endpoint:** `POST /posts/:id/vote`  
**Authentication:** Required

**Request Body:**

```json
{
  "voteType": "upvote"
}
```

**Validation Rules:**

- `voteType`: "upvote" or "downvote"

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Vote recorded successfully",
  "data": {
    "votes": {
      "upvotes": 16,
      "downvotes": 2
    }
  }
}
```

---

## Notification Endpoints

### Get User Notifications

Get all notifications for authenticated user.

**Endpoint:** `GET /notifications`  
**Authentication:** Required

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `isRead` (optional): Filter by read status (true/false)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notifications retrieved successfully",
  "data": {
    "notifications": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "userId": "507f1f77bcf86cd799439012",
        "type": "mention",
        "message": "John Doe mentioned you in a post",
        "relatedId": "507f1f77bcf86cd799439013",
        "relatedType": "post",
        "isRead": false,
        "createdAt": "2025-11-07T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3
    }
  }
}
```

---

### Get Unread Count

Get count of unread notifications.

**Endpoint:** `GET /notifications/unread-count`  
**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Unread count retrieved successfully",
  "data": {
    "count": 5
  }
}
```

---

### Get Notification by ID

Get specific notification.

**Endpoint:** `GET /notifications/:id`  
**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "type": "mention",
    "message": "John Doe mentioned you in a post",
    "relatedId": "507f1f77bcf86cd799439013",
    "isRead": false,
    "createdAt": "2025-11-07T10:00:00.000Z"
  }
}
```

---

### Mark Notification as Read

Mark a notification as read.

**Endpoint:** `PATCH /notifications/:id/read`  
**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification marked as read",
  "data": null
}
```

---

### Mark All as Read

Mark all notifications as read.

**Endpoint:** `PATCH /notifications/mark-all-read`  
**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "All notifications marked as read",
  "data": null
}
```

---

### Delete Notification

Delete a specific notification.

**Endpoint:** `DELETE /notifications/:id`  
**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Notification deleted successfully",
  "data": null
}
```

---

### Delete All Read Notifications

Delete all read notifications.

**Endpoint:** `DELETE /notifications/read/all`  
**Authentication:** Required

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "All read notifications deleted",
  "data": null
}
```

---

## Admin Endpoints

**Note:** All admin endpoints require authentication and appropriate role (Admin or Moderator).

### Get Dashboard Stats

Get system-wide statistics.

**Endpoint:** `GET /admin/dashboard`  
**Authentication:** Required (Admin/Moderator)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Dashboard stats retrieved successfully",
  "data": {
    "users": {
      "total": 1000,
      "active": 850,
      "banned": 10
    },
    "threads": {
      "total": 500,
      "active": 480,
      "locked": 20
    },
    "posts": {
      "total": 5000,
      "today": 150
    },
    "reports": {
      "pending": 5,
      "total": 100
    }
  }
}
```

---

### Get User Stats

Get detailed user statistics.

**Endpoint:** `GET /admin/users/stats`  
**Authentication:** Required (Admin/Moderator)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User stats retrieved successfully",
  "data": {
    "totalUsers": 1000,
    "newUsersToday": 20,
    "newUsersThisWeek": 150,
    "verifiedUsers": 850,
    "bannedUsers": 10,
    "roleDistribution": {
      "user": 980,
      "moderator": 15,
      "admin": 5
    }
  }
}
```

---

### Get Thread Stats

Get detailed thread statistics.

**Endpoint:** `GET /admin/threads/stats`  
**Authentication:** Required (Admin/Moderator)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Thread stats retrieved successfully",
  "data": {
    "totalThreads": 500,
    "activeThreads": 480,
    "lockedThreads": 20,
    "threadsToday": 15,
    "mostViewed": [...]
  }
}
```

---

### Get Post Stats

Get detailed post statistics.

**Endpoint:** `GET /admin/posts/stats`  
**Authentication:** Required (Admin/Moderator)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Post stats retrieved successfully",
  "data": {
    "totalPosts": 5000,
    "postsToday": 150,
    "postsThisWeek": 1000,
    "flaggedPosts": 5
  }
}
```

---

### Get AI Moderation Summary

Get AI moderation statistics.

**Endpoint:** `GET /admin/ai-moderation/summary`  
**Authentication:** Required (Admin/Moderator)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "AI moderation summary retrieved successfully",
  "data": {
    "totalChecked": 5000,
    "flagged": 50,
    "flaggedPercentage": 1.0,
    "recentFlags": [...]
  }
}
```

---

### Get All Users (Admin)

Get all users with admin-specific details.

**Endpoint:** `GET /admin/users`  
**Authentication:** Required (Admin/Moderator)

**Query Parameters:**

- `page`: Page number
- `limit`: Items per page
- `role`: Filter by role
- `status`: Filter by ban status

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Users retrieved successfully",
  "data": {
    "users": [...],
    "pagination": {...}
  }
}
```

---

### Update User (Admin)

Update user details as admin.

**Endpoint:** `PATCH /admin/users/:userId`  
**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "role": "moderator",
  "isVerified": true
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User updated successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "role": "moderator",
    "isVerified": true
  }
}
```

---

### Ban User

Ban a user temporarily or permanently.

**Endpoint:** `POST /admin/users/:userId/ban`  
**Authentication:** Required (Admin/Moderator)

**Request Body:**

```json
{
  "reason": "Violation of community guidelines",
  "duration": 7,
  "permanent": false
}
```

**Validation Rules:**

- `reason`: Required, 10-500 characters
- `duration`: Days (optional, for temporary ban)
- `permanent`: Boolean (optional)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User banned successfully",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "isBanned": true,
    "bannedUntil": "2025-11-14T10:00:00.000Z",
    "banReason": "Violation of community guidelines"
  }
}
```

---

### Unban User

Remove ban from a user.

**Endpoint:** `POST /admin/users/:userId/unban`  
**Authentication:** Required (Admin/Moderator)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User unbanned successfully",
  "data": null
}
```

---

### Create Report

Report content or user.

**Endpoint:** `POST /admin/reports`  
**Authentication:** Required

**Request Body:**

```json
{
  "reportedUserId": "507f1f77bcf86cd799439011",
  "contentType": "post",
  "contentId": "507f1f77bcf86cd799439012",
  "reason": "spam",
  "description": "This post contains spam links"
}
```

**Validation Rules:**

- `reportedUserId`: Required
- `contentType`: "post", "thread", or "user"
- `contentId`: Required
- `reason`: Required enum
- `description`: Optional, max 1000 characters

**Success Response (201):**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Report created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "reporterId": "507f1f77bcf86cd799439014",
    "reportedUserId": "507f1f77bcf86cd799439011",
    "contentType": "post",
    "contentId": "507f1f77bcf86cd799439012",
    "reason": "spam",
    "status": "pending",
    "createdAt": "2025-11-07T10:00:00.000Z"
  }
}
```

---

### Get All Reports

Get all reports with filtering.

**Endpoint:** `GET /admin/reports`  
**Authentication:** Required (Admin/Moderator)

**Query Parameters:**

- `page`: Page number
- `limit`: Items per page
- `status`: Filter by status (pending, reviewed, dismissed)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Reports retrieved successfully",
  "data": {
    "reports": [...],
    "pagination": {...}
  }
}
```

---

### Get Report by ID

Get specific report details.

**Endpoint:** `GET /admin/reports/:reportId`  
**Authentication:** Required (Admin/Moderator)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Report retrieved successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439013",
    "reporter": {...},
    "reportedUser": {...},
    "contentType": "post",
    "content": {...},
    "reason": "spam",
    "status": "pending",
    "createdAt": "2025-11-07T10:00:00.000Z"
  }
}
```

---

### Take Report Action

Take action on a report.

**Endpoint:** `POST /admin/reports/:reportId/action`  
**Authentication:** Required (Admin/Moderator)

**Request Body:**

```json
{
  "action": "ban_user",
  "notes": "User banned for spam"
}
```

**Available Actions:**

- `dismiss`: Dismiss report
- `delete_content`: Delete reported content
- `ban_user`: Ban the reported user
- `warn_user`: Send warning to user

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Report action taken successfully",
  "data": {
    "reportId": "507f1f77bcf86cd799439013",
    "action": "ban_user",
    "status": "reviewed",
    "reviewedBy": "507f1f77bcf86cd799439015",
    "reviewedAt": "2025-11-07T11:00:00.000Z"
  }
}
```

---

### Get Activity Logs

Get system activity logs.

**Endpoint:** `GET /admin/activity-logs`  
**Authentication:** Required (Admin)

**Query Parameters:**

- `page`: Page number
- `limit`: Items per page
- `userId`: Filter by user ID
- `action`: Filter by action type

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Activity logs retrieved successfully",
  "data": {
    "logs": [...],
    "pagination": {...}
  }
}
```

---

### Get System Settings

Get system configuration.

**Endpoint:** `GET /admin/settings`  
**Authentication:** Required (Admin)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "System settings retrieved successfully",
  "data": {
    "siteName": "AI Forum",
    "maintenanceMode": false,
    "allowRegistration": true,
    "requireEmailVerification": true,
    "maxThreadsPerDay": 10,
    "maxPostsPerDay": 50
  }
}
```

---

### Update System Settings

Update system configuration.

**Endpoint:** `PATCH /admin/settings`  
**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "maintenanceMode": false,
  "allowRegistration": true,
  "requireEmailVerification": true
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "System settings updated successfully",
  "data": {
    "siteName": "AI Forum",
    "maintenanceMode": false,
    "allowRegistration": true
  }
}
```

---

## Webhook Endpoints

### Receive Email Status Webhook

Receive email delivery status from external providers (SendGrid, Mailgun, etc.).

**Endpoint:** `POST /webhook/email/status`  
**Authentication:** HMAC signature verification

**Headers:**

```
X-Webhook-Signature: <HMAC-SHA256-signature>
Content-Type: application/json
```

**Request Body (Example from SendGrid):**

```json
{
  "event": "delivered",
  "email": "user@example.com",
  "timestamp": 1635789600,
  "smtp-id": "<unique-id@mail.com>",
  "category": "verification"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Webhook received and queued for processing",
  "data": null
}
```

**Error Response (401):**

```json
{
  "success": false,
  "message": "Invalid webhook signature"
}
```

---

### Test Webhook

Test webhook endpoint (development only).

**Endpoint:** `POST /webhook/test`  
**Authentication:** Required (Admin)

**Request Body:**

```json
{
  "event": "test",
  "data": {
    "message": "Test webhook event"
  }
}
```

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Test webhook received successfully",
  "data": null
}
```

---

### Get Webhook Logs

Get webhook event logs (for debugging).

**Endpoint:** `GET /webhook/logs`  
**Authentication:** Required (Admin)

**Query Parameters:**

- `page`: Page number
- `limit`: Items per page
- `event`: Filter by event type
- `status`: Filter by status (success, failed)

**Success Response (200):**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Webhook logs retrieved successfully",
  "data": {
    "logs": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "event": "email.delivered",
        "payload": {...},
        "source": "email",
        "status": "success",
        "timestamp": "2025-11-07T10:00:00.000Z",
        "createdAt": "2025-11-07T10:00:01.000Z"
      }
    ],
    "pagination": {...}
  }
}
```

---

## WebSocket Events (Socket.IO)

### Connection

**Event:** `connection`

**Client → Server:**

```javascript
socket.on("connection", () => {
  console.log("Connected to server");
});
```

---

### Join Thread Room

Subscribe to real-time updates for a thread.

**Event:** `join-thread`

**Client → Server:**

```javascript
socket.emit("join-thread", { threadId: "507f1f77bcf86cd799439011" });
```

---

### Leave Thread Room

Unsubscribe from thread updates.

**Event:** `leave-thread`

**Client → Server:**

```javascript
socket.emit("leave-thread", { threadId: "507f1f77bcf86cd799439011" });
```

---

### New Post Created

Receive notification when new post is created in subscribed thread.

**Event:** `new-post`

**Server → Client:**

```javascript
socket.on("new-post", (data) => {
  console.log("New post:", data);
  // data: { threadId, post: {...} }
});
```

---

### Post Updated

Receive notification when post is updated.

**Event:** `post-updated`

**Server → Client:**

```javascript
socket.on("post-updated", (data) => {
  console.log("Post updated:", data);
  // data: { threadId, postId, updates: {...} }
});
```

---

### New Notification

Receive real-time notifications.

**Event:** `notification`

**Server → Client:**

```javascript
socket.on("notification", (notification) => {
  console.log("New notification:", notification);
  // notification: { type, message, relatedId, ... }
});
```

---

## Example Usage

### Complete Authentication Flow

```javascript
// 1. Register
const registerResponse = await fetch(
  "http://localhost:5000/api/v1/auth/register",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass123!",
      confirmPassword: "SecurePass123!",
    }),
  }
);
const { accessToken, refreshToken } = await registerResponse.json();

// 2. Store tokens
localStorage.setItem("accessToken", accessToken);
localStorage.setItem("refreshToken", refreshToken);

// 3. Use access token for authenticated requests
const threadsResponse = await fetch("http://localhost:5000/api/v1/threads", {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

// 4. Refresh token when access token expires
const refreshResponse = await fetch(
  "http://localhost:5000/api/v1/auth/refresh-token",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  }
);
const { accessToken: newAccessToken } = await refreshResponse.json();
localStorage.setItem("accessToken", newAccessToken);
```

---

### Creating a Thread with Posts

```javascript
// 1. Create thread
const createThreadResponse = await fetch(
  "http://localhost:5000/api/v1/threads",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "How to use async/await in JavaScript?",
      description: "I need help understanding async patterns...",
      tags: ["javascript", "async"],
    }),
  }
);
const { data: thread } = await createThreadResponse.json();

// 2. Create post in thread
const createPostResponse = await fetch("http://localhost:5000/api/v1/posts", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    threadId: thread._id,
    content: "Here is my solution...",
  }),
});
```

---

### Real-Time Updates with Socket.IO

```javascript
import io from "socket.io-client";

// Connect with authentication
const socket = io("http://localhost:5000", {
  auth: {
    token: accessToken,
  },
});

// Join thread room
socket.emit("join-thread", { threadId: "507f1f77bcf86cd799439011" });

// Listen for new posts
socket.on("new-post", (data) => {
  console.log("New post in thread:", data);
  // Update UI with new post
});

// Listen for notifications
socket.on("notification", (notification) => {
  console.log("New notification:", notification);
  // Show notification to user
});
```

---

## Postman Collection

A complete Postman collection is available for testing all endpoints.

**Import Link:** [Download Postman Collection](#)

**Environment Variables:**

- `baseUrl`: http://localhost:5000/api/v1
- `accessToken`: Your access token
- `refreshToken`: Your refresh token

---

**Last Updated:** November 2025  
**API Version:** v1
