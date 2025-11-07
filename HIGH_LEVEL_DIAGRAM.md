# HIGH-LEVEL SYSTEM ARCHITECTURE

## AI-Powered Chat Forum Backend

---

## 🎨 MAIN SYSTEM DIAGRAM (Draw This in Excalidraw)

```
                    ┌─────────────────────────────────┐
                    │       CLIENT LAYER              │
                    │   (Browser/Mobile/API Tools)    │
                    │      Color: Light Blue          │
                    │                                 │
                    │  [Browser] [Mobile] [Postman]   │
                    └────────────┬────────────────────┘
                                 │
                          HTTP/WebSocket
                          Port 5000
                                 │
                                 ▼
    ┌────────────────────────────────────────────────────────────┐
    │                                                            │
    │              EXPRESS.JS API SERVER                        │
    │                 (Monolithic)                              │
    │              Color: Light Green                           │
    │                                                            │
    │  ┌──────────────────────────────────────────────────┐    │
    │  │  Security: Helmet | CORS | Rate Limit            │    │
    │  └──────────────────────────────────────────────────┘    │
    │  ┌──────────────────────────────────────────────────┐    │
    │  │  Middleware: JWT Auth | RBAC | Zod Validation    │    │
    │  └──────────────────────────────────────────────────┘    │
    │  ┌──────────────────────────────────────────────────┐    │
    │  │  7 Business Modules:                             │    │
    │  │  Auth | Users | Threads | Posts                  │    │
    │  │  Notifications | Admin | Webhooks                │    │
    │  └──────────────────────────────────────────────────┘    │
    │                                                            │
    └───────────┬────────────────────────┬───────────────┬──────┘
                │                        │               │
                │                        │               │
                ▼                        ▼               ▼
    ┌──────────────────┐    ┌──────────────────┐    ┌──────────┐
    │     REDIS        │    │    RABBITMQ      │    │SOCKET.IO │
    │   Port 6379      │    │   Port 5672      │    │(Real-time)│
    │  Color: Purple   │    │ Color: Orange    │    │Purple    │
    │                  │    │                  │    │          │
    │  Cache:          │    │  4 Queues:       │    │ Events:  │
    │  • Sessions      │    │  • AI Moderation │    │ • Join   │
    │  • Users         │    │  • AI Summary    │    │ • Post   │
    │  • Threads       │    │  • Notifications │    │ • Update │
    │  TTL: 5 min      │    │  • Webhooks      │    │          │
    └──────────────────┘    └──────────────────┘    └──────────┘
                │                        │               │
                └────────────┬───────────┴───────────────┘
                             │
                             ▼
                ┌─────────────────────────────┐
                │       MONGODB               │
                │      Port 27017             │
                │     Color: Dark Blue        │
                │                             │
                │  6 Collections:             │
                │  ┌─────┐  ┌────────┐       │
                │  │users│  │threads │       │
                │  └─────┘  └────────┘       │
                │  ┌─────┐  ┌──────────────┐ │
                │  │posts│  │notifications │ │
                │  └─────┘  └──────────────┘ │
                │  ┌───────┐  ┌───────────┐  │
                │  │reports│  │webhooklogs│  │
                │  └───────┘  └───────────┘  │
                └──────────────┬──────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │         BACKGROUND WORKERS                   │
        │          Color: Yellow                       │
        │                                              │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
        │  │ AI Mod   │  │ AI Sum   │  │ Notify   │  │
        │  │ Worker   │  │ Worker   │  │ Worker   │  │
        │  └──────────┘  └──────────┘  └──────────┘  │
        │              ┌──────────┐                   │
        │              │ Webhook  │                   │
        │              │ Worker   │                   │
        │              └──────────┘                   │
        └──────────────────┬───────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────────┐
        │        EXTERNAL SERVICES                     │
        │         Color: Gray                          │
        │                                              │
        │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
        │  │ OpenAI   │  │  SMTP    │  │ Webhook  │  │
        │  │ GPT-4    │  │  Email   │  │ Provider │  │
        │  │   API    │  │  Server  │  │(Optional)│  │
        │  └──────────┘  └──────────┘  └──────────┘  │
        └──────────────────────────────────────────────┘
```

---

## 📏 DRAWING INSTRUCTIONS FOR EXCALIDRAW:

### Step 1: CLIENT LAYER (Top)

```
Shape: Rounded Rectangle
Width: 700px, Height: 120px
Color: #B3D9FF (Light Blue)
Border: 2px solid

Inside: 3 small boxes
- Browser (150x60)
- Mobile (150x60)
- Postman (150x60)

Text: "CLIENT LAYER" (24px, bold)
Arrow down: Label "HTTP/WebSocket Port 5000"
```

### Step 2: EXPRESS SERVER (Main Box)

```
Shape: Rounded Rectangle
Width: 800px, Height: 350px
Color: #B3FFB3 (Light Green)
Border: 3px solid

Title: "EXPRESS.JS API SERVER (Monolithic)" (22px, bold)

3 Horizontal sections inside:
1. Security bar (full width, 60px height)
   Text: "Helmet | CORS | Rate Limit"

2. Middleware bar (full width, 60px height)
   Text: "JWT Auth | RBAC | Zod Validation"

3. Modules section (full width, 100px height)
   Text: "7 Business Modules:"
   "Auth | Users | Threads | Posts"
   "Notifications | Admin | Webhooks"

3 arrows down from bottom
```

### Step 3: INFRASTRUCTURE (3 Boxes Side by Side)

```
Box 1: REDIS
- Size: 240x180px
- Color: #E6B3FF (Light Purple)
- Text: "REDIS\nPort 6379"
- Inside: "Cache:\n• Sessions\n• Users\n• Threads"

Box 2: RABBITMQ
- Size: 240x180px
- Color: #FFD9B3 (Light Orange)
- Text: "RABBITMQ\nPort 5672"
- Inside: "4 Queues:\n• AI Moderation\n• AI Summary\n• Notifications\n• Webhooks"

Box 3: SOCKET.IO
- Size: 240x180px
- Color: #D9B3FF (Lavender)
- Text: "SOCKET.IO\n(Real-time)"
- Inside: "Events:\n• Join\n• Post\n• Update"

Space between boxes: 30px
All 3 arrows merge and go down
```

### Step 4: DATABASE (Center)

```
Shape: Rounded Rectangle
Width: 450px, Height: 250px
Color: #6699FF (Dark Blue)
Border: 3px solid
Text color: White

Title: "MONGODB" (24px, bold)
Subtitle: "Port 27017"

Inside: 6 small boxes (2 rows, 3 columns)
Row 1: [users] [threads] [posts]
Row 2: [notifications] [reports] [webhooklogs]

Each box: 120x50px
Arrow down
```

### Step 5: WORKERS (4 Boxes)

```
Container: Large rounded box
Width: 700px, Height: 200px
Color: #FFFF99 (Light Yellow)

Title: "BACKGROUND WORKERS" (20px, bold)

Inside: 4 boxes (2x2 grid)
Top row: [AI Mod Worker] [AI Sum Worker]
Bottom row: [Notify Worker] [Webhook Worker]

Each box: 150x70px
Arrow down
```

### Step 6: EXTERNAL SERVICES (Bottom)

```
Container: Large rounded box
Width: 700px, Height: 150px
Color: #CCCCCC (Light Gray)

Title: "EXTERNAL SERVICES" (20px, bold)

Inside: 3 boxes horizontal
[OpenAI GPT-4] [SMTP Email] [Webhook Provider]

Each box: 200x80px
```

---

## 🎨 COLOR PALETTE (Copy to Excalidraw):

```css
CLIENT:          #B3D9FF
SERVER:          #B3FFB3
REDIS:           #E6B3FF
RABBITMQ:        #FFD9B3
SOCKET:          #D9B3FF
MONGODB:         #6699FF
WORKERS:         #FFFF99
EXTERNAL:        #CCCCCC
ARROWS:          #000000 (Black, 2px thickness)
```

---

## 📐 LAYOUT POSITIONS (From Top):

```
CLIENT:         Y = 50px
↓ Arrow
SERVER:         Y = 300px
↓ 3 Arrows
INFRASTRUCTURE: Y = 750px (3 boxes side by side)
↓ Arrow (merge to center)
MONGODB:        Y = 1050px (centered)
↓ Arrow
WORKERS:        Y = 1400px (centered)
↓ Arrow
EXTERNAL:       Y = 1700px (centered)

Total Height: ~2000px
Total Width: ~900px
```

---

## 🚀 QUICK DRAWING STEPS:

1. ✅ **Draw CLIENT box** at top (blue)
2. ✅ **Draw big SERVER box** below (green)
3. ✅ **Draw 3 infrastructure boxes** side by side (purple/orange)
4. ✅ **Draw MONGODB** centered (dark blue)
5. ✅ **Draw WORKERS container** with 4 boxes (yellow)
6. ✅ **Draw EXTERNAL** at bottom (gray)
7. ✅ **Connect with arrows** (straight lines)
8. ✅ **Add text labels** (clear, readable)
9. ✅ **Align everything** (use Excalidraw align tool)
10. ✅ **Export as PNG** (2000x2400px)

---

## 💡 PRO TIPS:

### Text Sizes:

- **Main titles**: 24-28px, Bold
- **Subtitles**: 18-20px, Regular
- **Details**: 14-16px, Regular
- **Labels on arrows**: 14px, Italic

### Spacing:

- Between layers: 80-100px
- Between boxes: 20-30px
- Arrow margins: 20px from box edges

### Borders:

- Main containers: 3px solid
- Sub-boxes: 2px solid
- Dashed for optional connections

---

## 🎯 MINIMAL VERSION (If time is short):

```
┌─────────────┐
│   CLIENTS   │  Blue
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  EXPRESS    │  Green
│   SERVER    │
│  Port 5000  │
└──────┬──────┘
       │
   ┌───┴───┐
   │       │
   ▼       ▼
┌──────┐ ┌──────┐
│Redis │ │RabbitMQ│ Purple/Orange
└──────┘ └──────┘
   │       │
   └───┬───┘
       ▼
┌─────────────┐
│   MongoDB   │  Dark Blue
│6 Collections│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 4 Workers   │  Yellow
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  External   │  Gray
│OpenAI/SMTP  │
└─────────────┘
```

---

## 📸 EXPORT SETTINGS:

**Recommended:**

- Format: PNG
- Scale: 2x (for high quality)
- Background: White or Transparent
- Padding: 50px

**File name:** `system-architecture.png`

**Save to:** `backend/docs/images/`

---

Ei blueprint follow korle **15-20 minutes** e professional high-level diagram ready! 🎨

Excalidraw link: **https://excalidraw.com**

Drawing shuru koro! 🚀
