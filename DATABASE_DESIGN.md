# Database Design - AI-Powered Chat Forum

## Table of Contents

1. [Overview](#overview)
2. [Database Selection](#database-selection)
3. [Collections Schema](#collections-schema)
4. [Relationships](#relationships)
5. [Indexes](#indexes)
6. [Data Access Patterns](#data-access-patterns)
7. [Data Integrity](#data-integrity)

---

## Overview

### Database Technology

**MongoDB** (NoSQL Document Database)

### Why MongoDB?

- **Flexible Schema:** Easy to evolve data model
- **Document Model:** Natural fit for nested data (replies, notifications)
- **Horizontal Scalability:** Sharding support for growth
- **Rich Querying:** Powerful aggregation framework
- **Performance:** Fast reads with proper indexing
- **JSON-like Documents:** Direct mapping to JavaScript objects

### Database Naming

**Database:** `chat-forum`

---

## Collections Schema

### 1. Users Collection

**Collection Name:** `users`

**Purpose:** Store user account information and profile data

```typescript
{
  _id: ObjectId,                    // MongoDB generated ID
  name: String,                     // User's display name (3-50 chars)
  email: String,                    // Unique email (lowercase)
  password: String,                 // Bcrypt hashed password
  role: String,                     // Enum: 'user' | 'moderator' | 'admin'
  isVerified: Boolean,              // Email verification status
  avatar: String | null,            // Profile picture URL (optional)
  bio: String | null,               // User biography (max 500 chars)
  isBanned: Boolean,                // Account ban status
  bannedUntil: Date | null,         // Temporary ban expiry date
  banReason: String | null,         // Reason for ban
  createdAt: Date,                  // Account creation timestamp
  updatedAt: Date                   // Last update timestamp
}
```

**Indexes:**

```javascript
email: 1(unique); // Fast email lookup for login
createdAt: -1; // Sort by registration date
role: 1; // Filter by user role
```

**Validation Rules:**

- `name`: Required, 3-50 characters
- `email`: Required, valid email format, unique, lowercase
- `password`: Required, bcrypt hash
- `role`: Default 'user', enum validation
- `isVerified`: Default false
- `isBanned`: Default false

---

### 2. Threads Collection

**Collection Name:** `threads`

**Purpose:** Store discussion threads/topics

```typescript
{
  _id: ObjectId,                    // Thread ID
  title: String,                    // Thread title (5-200 chars)
  description: String,              // Thread description (10-2000 chars)
  authorId: ObjectId,               // Reference to users._id
  status: String,                   // Enum: 'active' | 'locked' | 'deleted'
  isPinned: Boolean,                // Pinned to top status
  viewCount: Number,                // Number of views
  postCount: Number,                // Number of posts in thread
  lastActivityAt: Date,             // Last post/reply timestamp
  tags: [String],                   // Array of tags (optional)
  summary: String | null,           // AI-generated summary (optional)
  createdAt: Date,                  // Thread creation timestamp
  updatedAt: Date                   // Last update timestamp
}
```

**Indexes:**

```javascript
authorId: 1                         // Find threads by author
status: 1                           // Filter by status
createdAt: -1                       // Sort by creation date (newest first)
lastActivityAt: -1                  // Sort by activity (active threads)
{ title: 'text', description: 'text' }  // Full-text search
```

**Validation Rules:**

- `title`: Required, 5-200 characters
- `description`: Required, 10-2000 characters
- `status`: Default 'active', enum validation
- `isPinned`: Default false
- `viewCount`: Default 0, non-negative
- `postCount`: Default 0, non-negative

---

### 3. Posts Collection

**Collection Name:** `posts`

**Purpose:** Store posts and replies in threads

```typescript
{
  _id: ObjectId,                    // Post ID
  threadId: ObjectId,               // Reference to threads._id
  authorId: ObjectId,               // Reference to users._id
  content: String,                  // Post content (1-10000 chars)
  parentId: ObjectId | null,        // Reference to parent post (null = root post)
  status: String,                   // Enum: 'active' | 'deleted' | 'flagged'
  mentions: [ObjectId],             // Array of mentioned user IDs
  votes: {
    upvotes: Number,                // Upvote count
    downvotes: Number,              // Downvote count
    voters: [{                      // Array of voters (embedded)
      userId: ObjectId,
      voteType: String              // 'upvote' | 'downvote'
    }]
  },
  isEdited: Boolean,                // Edit status
  editedAt: Date | null,            // Last edit timestamp
  aiModeration: {                   // AI moderation result (embedded)
    checked: Boolean,               // AI check performed
    flagged: Boolean,               // Content flagged
    reason: String | null,          // Flagging reason
    checkedAt: Date | null          // AI check timestamp
  },
  createdAt: Date,                  // Post creation timestamp
  updatedAt: Date                   // Last update timestamp
}
```

**Indexes:**

```javascript
{ threadId: 1, createdAt: -1 }      // Compound: Find posts in thread, sorted
authorId: 1                         // Find posts by author
parentId: 1                         // Find replies to a post
status: 1                           // Filter by status
mentions: 1                         // Find posts mentioning user
```

**Validation Rules:**

- `content`: Required, 1-10000 characters
- `status`: Default 'active', enum validation
- `mentions`: Array of valid ObjectIds
- `votes.upvotes`: Default 0, non-negative
- `votes.downvotes`: Default 0, non-negative
- `isEdited`: Default false

---

### 4. Notifications Collection

**Collection Name:** `notifications`

**Purpose:** Store user notifications

```typescript
{
  _id: ObjectId,                    // Notification ID
  userId: ObjectId,                 // Reference to users._id (recipient)
  type: String,                     // Enum: 'mention' | 'reply' | 'system'
  message: String,                  // Notification message
  relatedId: ObjectId | null,       // Related resource ID (thread/post)
  relatedType: String | null,       // Related resource type
  isRead: Boolean,                  // Read status
  readAt: Date | null,              // Read timestamp
  createdAt: Date,                  // Notification creation timestamp
  expiresAt: Date                   // TTL for auto-deletion (30 days)
}
```

**Indexes:**

```javascript
{ userId: 1, createdAt: -1 }        // Compound: Find user notifications, sorted
isRead: 1                           // Filter unread notifications
expiresAt: 1 (TTL)                  // Auto-delete expired notifications
```

**Validation Rules:**

- `type`: Required, enum validation
- `message`: Required, 1-500 characters
- `isRead`: Default false
- `expiresAt`: Auto-set to createdAt + 30 days

**TTL Index:**
Notifications automatically deleted 30 days after `expiresAt`

---

### 5. Reports Collection

**Collection Name:** `reports`

**Purpose:** Store content reports for moderation

```typescript
{
  _id: ObjectId,                    // Report ID
  reporterId: ObjectId,             // Reference to users._id (reporter)
  reportedUserId: ObjectId,         // Reference to users._id (reported user)
  contentType: String,              // Enum: 'post' | 'thread' | 'user'
  contentId: ObjectId,              // Reference to reported content
  reason: String,                   // Report reason (enum)
  description: String | null,       // Additional details (optional)
  status: String,                   // Enum: 'pending' | 'reviewed' | 'dismissed'
  reviewedBy: ObjectId | null,      // Reference to moderator user ID
  reviewedAt: Date | null,          // Review timestamp
  action: String | null,            // Action taken (if any)
  createdAt: Date,                  // Report creation timestamp
  updatedAt: Date                   // Last update timestamp
}
```

**Indexes:**

```javascript
status: 1; // Filter by status
reporterId: 1; // Find reports by reporter
reportedUserId: 1; // Find reports against user
contentId: 1; // Find reports for content
createdAt: -1; // Sort by report date
```

**Validation Rules:**

- `reason`: Required, enum validation
- `status`: Default 'pending', enum validation
- `contentType`: Required, enum validation

---

### 6. WebhookLogs Collection

**Collection Name:** `webhooklogs`

**Purpose:** Log webhook events for debugging and monitoring

```typescript
{
  _id: ObjectId,                    // Log ID
  event: String,                    // Event type (e.g., 'email.delivered')
  payload: Object,                  // Event payload (flexible schema)
  source: String,                   // Event source ('email' | 'external')
  status: String,                   // 'success' | 'failed'
  error: String | null,             // Error message (if failed)
  timestamp: Date,                  // Event timestamp
  createdAt: Date                   // Log creation timestamp
}
```

**Indexes:**

```javascript
event: 1                            // Filter by event type
source: 1                           // Filter by source
status: 1                           // Filter by status
timestamp: -1                       // Sort by event time
createdAt: -1 (TTL: 90 days)       // Auto-delete old logs
```

**Validation Rules:**

- `event`: Required
- `source`: Required, enum validation
- `status`: Required, enum validation
- `timestamp`: Required

**TTL Index:**
Logs automatically deleted after 90 days

---

## Relationships

### Entity Relationship Diagram (ERD)

```
┌─────────────┐
│   Users     │
└──────┬──────┘
       │ 1
       │
       │ has many
       │
       ├───────────────┐
       │               │
       │ *             │ *
┌──────▼──────┐  ┌────▼────────┐
│   Threads   │  │    Posts    │
└──────┬──────┘  └─────┬───────┘
       │ 1              │ 1
       │                │
       │ has many       │ has many (self-referencing)
       │                │
       │ *              │ *
       └────────────────┤
                   ┌────▼────────┐
                   │    Posts    │ (replies)
                   └─────────────┘

┌─────────────┐
│   Users     │
└──────┬──────┘
       │ 1
       │
       │ receives many
       │
       │ *
┌──────▼─────────────┐
│  Notifications     │
└────────────────────┘

┌─────────────┐
│   Users     │
└──────┬──────┘
       │ 1
       │
       │ creates many
       │
       │ *
┌──────▼─────────────┐
│    Reports         │
└────────────────────┘
```

### Relationship Types

**1. Users → Threads (One-to-Many)**

- One user can create many threads
- Foreign Key: `threads.authorId` → `users._id`
- Cascade: Threads remain if user deleted (authorId set to null)

**2. Users → Posts (One-to-Many)**

- One user can create many posts
- Foreign Key: `posts.authorId` → `users._id`
- Cascade: Posts remain if user deleted (authorId set to null)

**3. Threads → Posts (One-to-Many)**

- One thread contains many posts
- Foreign Key: `posts.threadId` → `threads._id`
- Cascade: Delete posts if thread deleted

**4. Posts → Posts (Self-Referencing, One-to-Many)**

- One post can have many replies
- Foreign Key: `posts.parentId` → `posts._id`
- Cascade: Delete child posts if parent deleted

**5. Users → Notifications (One-to-Many)**

- One user receives many notifications
- Foreign Key: `notifications.userId` → `users._id`
- Cascade: Delete notifications if user deleted

**6. Users → Reports (Many-to-Many)**

- User can report many users/content
- User can be reported many times
- Foreign Keys:
  - `reports.reporterId` → `users._id`
  - `reports.reportedUserId` → `users._id`

---

## Indexes

### Index Strategy

**Purpose:** Optimize query performance for common access patterns

### Primary Indexes (Automatic)

```javascript
// All collections have _id index by default
_id: 1(unique);
```

### Secondary Indexes

#### Users Collection

```javascript
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: -1 });
db.users.createIndex({ role: 1 });
```

#### Threads Collection

```javascript
db.threads.createIndex({ authorId: 1 });
db.threads.createIndex({ status: 1 });
db.threads.createIndex({ createdAt: -1 });
db.threads.createIndex({ lastActivityAt: -1 });
db.threads.createIndex({ title: "text", description: "text" });
```

#### Posts Collection

```javascript
db.posts.createIndex({ threadId: 1, createdAt: -1 });
db.posts.createIndex({ authorId: 1 });
db.posts.createIndex({ parentId: 1 });
db.posts.createIndex({ status: 1 });
db.posts.createIndex({ mentions: 1 });
```

#### Notifications Collection

```javascript
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ isRead: 1 });
db.notifications.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

#### Reports Collection

```javascript
db.reports.createIndex({ status: 1 });
db.reports.createIndex({ reporterId: 1 });
db.reports.createIndex({ reportedUserId: 1 });
db.reports.createIndex({ contentId: 1 });
db.reports.createIndex({ createdAt: -1 });
```

#### WebhookLogs Collection

```javascript
db.webhooklogs.createIndex({ event: 1 });
db.webhooklogs.createIndex({ source: 1 });
db.webhooklogs.createIndex({ status: 1 });
db.webhooklogs.createIndex({ timestamp: -1 });
db.webhooklogs.createIndex({ createdAt: -1 }, { expireAfterSeconds: 7776000 }); // 90 days
```

### Compound Indexes

**Why Compound Indexes?**

- Optimize queries filtering by multiple fields
- Support sorting on indexed fields

**Examples:**

```javascript
// Posts: Find posts in thread, sorted by date
{ threadId: 1, createdAt: -1 }

// Notifications: Find user notifications, sorted by date
{ userId: 1, createdAt: -1 }
```

### Text Indexes

**Full-Text Search:**

```javascript
// Threads: Search by title and description
db.threads.createIndex(
  {
    title: "text",
    description: "text",
  },
  {
    weights: {
      title: 10, // Higher weight for title
      description: 5,
    },
  }
);
```

---

## Data Access Patterns

### Common Queries

**1. User Login**

```javascript
db.users.findOne({ email: "user@example.com" });
// Uses: email index (unique)
```

**2. Get Thread List**

```javascript
db.threads.find({ status: "active" }).sort({ lastActivityAt: -1 }).limit(20);
// Uses: status index, lastActivityAt index
```

**3. Get Posts in Thread**

```javascript
db.posts
  .find({
    threadId: ObjectId("..."),
    parentId: null,
  })
  .sort({ createdAt: -1 })
  .limit(20);
// Uses: { threadId: 1, createdAt: -1 } compound index
```

**4. Get Post Replies**

```javascript
db.posts.find({ parentId: ObjectId("...") }).sort({ createdAt: 1 });
// Uses: parentId index
```

**5. Get User Notifications**

```javascript
db.notifications
  .find({
    userId: ObjectId("..."),
    isRead: false,
  })
  .sort({ createdAt: -1 });
// Uses: { userId: 1, createdAt: -1 } compound index
```

**6. Search Threads**

```javascript
db.threads.find({
  $text: { $search: "javascript tutorial" },
});
// Uses: text index on title and description
```

**7. Get User's Threads**

```javascript
db.threads.find({ authorId: ObjectId("...") }).sort({ createdAt: -1 });
// Uses: authorId index
```

**8. Get Pending Reports**

```javascript
db.reports.find({ status: "pending" }).sort({ createdAt: -1 });
// Uses: status index
```

---

## Data Integrity

### Validation Rules

**Mongoose Schema Validation:**

```javascript
// Example: User Schema
{
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: {
      validator: (v) => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v),
      message: 'Invalid email format'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 60, // bcrypt hash length
    maxlength: 60
  }
}
```

### Referential Integrity

**Soft Deletes:**

- Users, threads, posts use status field
- Actual deletion only for sensitive data (GDPR compliance)

**Cascade Operations:**

```javascript
// Example: Delete thread cascade
// 1. Set thread status = 'deleted'
// 2. Set all posts in thread status = 'deleted'
// 3. Delete related notifications (optional)
```

### Data Consistency

**Atomic Operations:**

```javascript
// Example: Upvote post (atomic)
db.posts.updateOne(
  { _id: postId },
  {
    $inc: { "votes.upvotes": 1 },
    $push: { "votes.voters": { userId, voteType: "upvote" } },
  }
);
```

**Transactions (when needed):**

```javascript
// Example: Create thread with initial post
const session = await mongoose.startSession();
session.startTransaction();
try {
  const thread = await Thread.create([threadData], { session });
  const post = await Post.create([{ ...postData, threadId: thread._id }], {
    session,
  });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

## Performance Considerations

### Query Optimization

**1. Use Projections:**

```javascript
// Only select needed fields
db.users.find({}, { name: 1, email: 1, avatar: 1 });
```

**2. Use Lean Queries:**

```javascript
// Return plain JS objects (faster)
User.find({}).lean();
```

**3. Limit Results:**

```javascript
// Always paginate
db.threads
  .find()
  .limit(20)
  .skip(page * 20);
```

**4. Use Indexes:**

```javascript
// Ensure queries use indexes
db.threads.find({ status: "active" }).explain("executionStats");
```

### Caching Strategy

**Redis Cache Keys:**

```
thread:list:{page}:{limit}
thread:{id}
user:{id}
```

**Cache Invalidation:**

- Update/delete operations invalidate related cache
- TTL-based expiration for list views

---

## Backup Strategy

### MongoDB Backup

**1. Regular Backups:**

- Daily full backups
- Point-in-time recovery enabled

**2. Backup Method:**

```bash
mongodump --uri="mongodb://..." --out=/backup/$(date +%Y%m%d)
```

**3. Restoration:**

```bash
mongorestore --uri="mongodb://..." /backup/20251107
```

---

## Migration Strategy

### Schema Changes

**1. Additive Changes (Safe):**

- Add new fields with default values
- Add new indexes
- Add new collections

**2. Breaking Changes (Careful):**

- Remove fields (check usage first)
- Rename fields (use migration script)
- Change field types (convert data)

**3. Migration Scripts:**

```javascript
// Example: Add new field to existing documents
db.users.updateMany({ bio: { $exists: false } }, { $set: { bio: null } });
```

---

## Database Metrics

### Monitoring

**Key Metrics:**

- Collection sizes
- Index usage statistics
- Query performance
- Connection pool status
- Replication lag (if using replica sets)

**Commands:**

```javascript
// Collection stats
db.users.stats();

// Index stats
db.users.aggregate([{ $indexStats: {} }]);

// Current operations
db.currentOp();
```

---

**Last Updated:** November 2025
