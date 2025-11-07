# 🗄️ DATABASE DIAGRAM CREATION GUIDE

## Using MongoDB Compass + Excalidraw

---

## 🎯 OBJECTIVE:

Create a **visual ER diagram** showing 6 collections with relationships.

---

## 📊 METHOD 1: MongoDB Compass Schema Export

### Step 1: Open MongoDB Compass

```bash
# Connect to your database
mongodb://localhost:27017/chat-forum
```

### Step 2: Analyze Each Collection Schema

**For Each Collection (users, threads, posts, notifications, reports, webhooklogs):**

1. Click on collection name
2. Go to **"Schema"** tab
3. Click **"Analyze Schema"** button
4. Wait 5-10 seconds
5. Take screenshot of:
   - Field names
   - Data types
   - Sample values

### Step 3: Note Down Relationships

**From Your Code (`post.model.ts` example):**

```typescript
// RELATIONSHIPS:
threadId → references "Thread" collection
parentId → references "Post" collection (self-reference)
author   → references "User" collection
mentions → references "User" collection (array)
```

**Do this for all 6 collections.**

---

## 🎨 METHOD 2: Draw in Excalidraw (RECOMMENDED)

### Collection Schemas to Draw:

#### 1️⃣ **Users Collection**

```
┌─────────────────────────┐
│        USERS            │
│   Color: Light Blue     │
├─────────────────────────┤
│ _id: ObjectId (PK)      │
│ username: String        │
│ email: String           │
│ password: String (hash) │
│ role: Enum              │
│ avatar: String          │
│ bio: String             │
│ isBanned: Boolean       │
│ createdAt: Date         │
│ updatedAt: Date         │
└─────────────────────────┘
```

#### 2️⃣ **Threads Collection**

```
┌─────────────────────────┐
│       THREADS           │
│   Color: Light Green    │
├─────────────────────────┤
│ _id: ObjectId (PK)      │
│ title: String           │
│ description: String     │
│ author: ObjectId (FK)───┐
│ category: Enum          │ │
│ tags: Array<String>     │ │
│ isPinned: Boolean       │ │
│ isLocked: Boolean       │ │
│ status: Enum            │ │
│ createdAt: Date         │ │
│ updatedAt: Date         │ │
└─────────────────────────┘ │
                            │
                    References
                     USERS._id
```

#### 3️⃣ **Posts Collection**

```
┌─────────────────────────┐
│        POSTS            │
│   Color: Light Yellow   │
├─────────────────────────┤
│ _id: ObjectId (PK)      │
│ threadId: ObjectId (FK)─┼──► THREADS._id
│ parentId: ObjectId (FK)─┼──► POSTS._id (self)
│ content: String         │
│ author: ObjectId (FK)───┼──► USERS._id
│ mentions: [ObjectId]────┼──► USERS._id (array)
│ isEdited: Boolean       │
│ editedAt: Date          │
│ moderationStatus: Enum  │
│ aiScore: Object         │
│ aiReasoning: String     │◄─── Your selection!
│ aiRecommendation: Enum  │
│ status: Enum            │
│ createdAt: Date         │
│ updatedAt: Date         │
└─────────────────────────┘
```

#### 4️⃣ **Notifications Collection**

```
┌─────────────────────────┐
│    NOTIFICATIONS        │
│   Color: Light Purple   │
├─────────────────────────┤
│ _id: ObjectId (PK)      │
│ userId: ObjectId (FK)───┼──► USERS._id
│ type: Enum              │
│ title: String           │
│ message: String         │
│ relatedThread: ObjId────┼──► THREADS._id
│ relatedPost: ObjId──────┼──► POSTS._id
│ isRead: Boolean         │
│ createdAt: Date         │
└─────────────────────────┘
```

#### 5️⃣ **Reports Collection**

```
┌─────────────────────────┐
│       REPORTS           │
│   Color: Light Orange   │
├─────────────────────────┤
│ _id: ObjectId (PK)      │
│ reportedBy: ObjId (FK)──┼──► USERS._id
│ reportedUser: ObjId─────┼──► USERS._id
│ reportedPost: ObjId─────┼──► POSTS._id
│ reason: String          │
│ status: Enum            │
│ reviewedBy: ObjectId────┼──► USERS._id (admin)
│ createdAt: Date         │
└─────────────────────────┘
```

#### 6️⃣ **WebhookLogs Collection**

```
┌─────────────────────────┐
│     WEBHOOKLOGS         │
│   Color: Light Gray     │
├─────────────────────────┤
│ _id: ObjectId (PK)      │
│ url: String             │
│ method: String          │
│ payload: Object         │
│ response: Object        │
│ status: Number          │
│ triggeredBy: ObjId──────┼──► USERS._id
│ createdAt: Date         │
└─────────────────────────┘
```

---

## 🔗 RELATIONSHIP ARROWS:

### Draw These Connections:

```
USERS._id
    │
    ├──► THREADS.author (1:N)
    ├──► POSTS.author (1:N)
    ├──► POSTS.mentions (M:N)
    ├──► NOTIFICATIONS.userId (1:N)
    ├──► REPORTS.reportedBy (1:N)
    ├──► REPORTS.reportedUser (1:N)
    └──► WEBHOOKLOGS.triggeredBy (1:N)

THREADS._id
    │
    ├──► POSTS.threadId (1:N)
    └──► NOTIFICATIONS.relatedThread (1:N)

POSTS._id
    │
    ├──► POSTS.parentId (1:N self-reference)
    ├──► NOTIFICATIONS.relatedPost (1:N)
    └──► REPORTS.reportedPost (1:N)
```

---

## 🎨 EXCALIDRAW LAYOUT:

### Recommended Positions:

```
       ┌─────────┐
       │  USERS  │ ◄── Center top (Main entity)
       └────┬────┘
            │
     ┌──────┼──────┐
     │      │      │
     ▼      ▼      ▼
┌────────┐ ┌────┐ ┌──────────────┐
│THREADS │ │POSTS│ │NOTIFICATIONS │
└────┬───┘ └──┬─┘ └──────────────┘
     │       │
     └───┬───┘
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
┌─────────┐ ┌────────────┐
│ REPORTS │ │WEBHOOKLOGS │
└─────────┘ └────────────┘
```

---

## 🚀 QUICK STEPS TO CREATE:

### In Excalidraw:

1. **Draw 6 Boxes** (one per collection)

   - Size: 300x400px each
   - Colors as mentioned above
   - Rounded corners

2. **Add Field Names** inside each box

   - Font: 14px
   - Format: `fieldName: DataType`
   - Bold for PK: `_id: ObjectId (PK)`
   - Italic for FK: `author: ObjectId (FK)`

3. **Draw Arrows** for relationships

   - From FK field → to PK field
   - Label arrows with cardinality:
     - `1:N` (One-to-Many)
     - `M:N` (Many-to-Many)
     - `1:1` (One-to-One)

4. **Add Legend** (bottom right):

   ```
   PK = Primary Key
   FK = Foreign Key (ObjectId reference)
   1:N = One-to-Many
   M:N = Many-to-Many
   ```

5. **Export**:
   - Format: PNG
   - Scale: 2x
   - Background: White
   - Padding: 50px

---

## 📏 EXACT MEASUREMENTS:

### Collection Boxes:

- Width: 300px
- Height: 400px (adjust if more fields)
- Border: 2px solid
- Corner radius: 8px

### Title Bar (inside each box):

- Background: Darker shade
- Height: 50px
- Font: 18px bold, centered

### Field List:

- Padding: 15px
- Line height: 25px
- Font: 14px monospace

### Arrows:

- Thickness: 2px
- Color: #333333
- Style: Solid for 1:N, Dashed for M:N

---

## 🎨 COLOR SCHEME:

```css
Users:          #B3D9FF (Light Blue)
Threads:        #B3FFB3 (Light Green)
Posts:          #FFFF99 (Light Yellow)
Notifications:  #E6B3FF (Light Purple)
Reports:        #FFD9B3 (Light Orange)
WebhookLogs:    #CCCCCC (Light Gray)

Arrows:         #333333 (Dark Gray)
Text:           #000000 (Black)
Border:         #666666 (Medium Gray)
```

---

## 💡 PRO TIPS:

### For MongoDB Compass:

1. Use **"Indexes"** tab to see compound indexes
2. Use **"Explain Plan"** for query visualization
3. Export schema as JSON (if needed)

### For Excalidraw:

1. Group related fields (e.g., AI fields together)
2. Use text boxes for field descriptions
3. Align boxes using built-in alignment tools
4. Use layers: Collections → Arrows → Labels

### Common Mistakes to Avoid:

- ❌ Don't draw arrows FROM collection TO collection
- ✅ Draw arrows FROM FK field TO PK field
- ❌ Don't forget cardinality labels
- ✅ Clearly mark (PK) and (FK)

---

## 📸 WHAT TO EXPORT:

### Image 1: **Full ER Diagram**

- All 6 collections with relationships
- File: `database-er-diagram.png`

### Image 2: **Schema Details** (Optional)

- Individual collection schemas with:
  - Validation rules
  - Indexes
  - Sample data
- File: `collection-schemas.png`

---

## 🗂️ SAVE LOCATION:

```bash
backend/docs/images/
├── database-er-diagram.png       ← Main diagram
├── collection-schemas.png        ← Detailed view (optional)
└── mongodb-compass-schema.png    ← Compass screenshots (optional)
```

---

## ✅ CHECKLIST:

- [ ] All 6 collections drawn
- [ ] Primary keys marked (PK)
- [ ] Foreign keys marked (FK)
- [ ] Relationship arrows added
- [ ] Cardinality labels (1:N, M:N)
- [ ] Color coding applied
- [ ] Legend added
- [ ] Exported as PNG (2x scale)
- [ ] Saved to backend/docs/images/
- [ ] Referenced in README.md

---

## 🚀 ALTERNATIVE TOOLS (If You Want):

### 1. **Draw.io** (diagrams.net)

- Free, web-based
- Has ER diagram templates
- Export as PNG/SVG

### 2. **dbdiagram.io**

- DSL-based (code to diagram)
- Clean ER diagrams
- Export as PNG/PDF

### 3. **QuickDBD**

- Text-based schema
- Generates diagram automatically

### 4. **Moon Modeler**

- Desktop app
- Reverse engineer from MongoDB
- Auto-generate relationships

---

## 🎯 RECOMMENDATION:

**Best Combo:**

1. **MongoDB Compass** → View actual schema
2. **Excalidraw** → Draw beautiful ER diagram
3. **Screenshot** → Save and reference

**Time Estimate:** 25-30 minutes for complete ER diagram

---

## 📝 SAMPLE CODE TO EXTRACT SCHEMA:

If you want to programmatically extract schema:

```javascript
// Run in MongoDB Compass "mongosh" tab:

use chat-forum;

// Get all collections
db.getCollectionNames();

// Get schema for each collection (sample)
db.users.findOne();
db.threads.findOne();
db.posts.findOne();
db.notifications.findOne();
db.reports.findOne();
db.webhooklogs.findOne();

// Get indexes
db.users.getIndexes();
db.posts.getIndexes();
// ... repeat for all collections
```

---

Happy Diagramming! 🎨📊

Excalidraw link: **https://excalidraw.com**
