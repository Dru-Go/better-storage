# 🎒 TypeScript Storage System — A Laravel-Inspired File Storage Layer

> A flexible, testable, and extensible file storage abstraction for Node.js, inspired by Laravel’s `Storage` facade.

---

## 💡 Why This Exists

Every application handles files — but few handle them *well*. Whether you’re uploading user avatars, streaming video, or managing document archives, local filesystem logic quickly becomes tangled and hard to maintain.

Laravel solved this beautifully with its **Storage system** — providing a consistent, elegant API no matter the underlying storage driver.

This project brings that same idea to the JavaScript/TypeScript world.

---

## ⚙️ Features

✅ Clean, driver-based architecture.  
✅ Easy swapping between local, S3, or custom storage backends.  
✅ Metadata-first: access size, mime, visibility, and more.  
✅ Stream support for large files.  
✅ Signed URL scaffolding for secure temporary access.  
✅ Customizable path generation strategies.  
✅ Thoughtful, real-world tested — designed for production use.

---

## 🏗️ Current Drivers

- **Local Disk** (`fs-extra`) — fully tested.
- (Pluggable: more coming soon!)

---

## 🧠 Mental Model

This isn’t just another wrapper around `fs`.  
It’s a mental model: 

**“Store and retrieve files the same way — no matter where they live.”**

```ts
const file = await Storage.disk('local').get('profile.jpg');
await Storage.disk('s3').put('backups/data.zip', Buffer.from('my-data'));
```

---

## 📂 Example Folder Structure

```
src/
├─ config/
│  └─ disks.ts               # Disk definitions (local, s3, custom)
├─ drivers/
│  ├─ StorageDriver.ts       # Core interface
│  └─ LocalStorageDriver.ts  # Local disk implementation
├─ StorageManager.ts         # Disk registry & entry point
├─ path-generators/
│  ├─ DatePathGenerator.ts
│  └─ UserPathGenerator.ts
└─ index.ts                  # Export your public API
```

---

## 🧪 Testing Philosophy

This project is built with an emphasis on:

- **Real-world edge cases:** slow streams, broken uploads, visibility mismatches.
- **TypeScript-first design:** to catch structural mistakes early.
- **Flexible, clear mocks and fakes** to simulate different storage behaviors.

---

## 🚀 Quick Example

```ts
import { Storage } from './StorageManager';

const buffer = Buffer.from('Hello world');
await Storage.disk('local').put('test/hello.txt', buffer);

const contents = await Storage.disk('local').get('test/hello.txt');
console.log(contents.toString()); // "Hello world"
```

---

## 🔥 Work in Progress

This project is under active development!

- ✔️ Week 1: Local driver, metadata structure, storage registry.
- ✔️ Week 2: Streaming, signed URLs, path generators.
- 🔜 Week 3: More robust error handling, edge cases, cloud drivers.

If you want to follow the design decisions, check out the accompanying blog series:
> ["Building a Laravel-Inspired Storage System in TypeScript"](https://world-rose.vercel.app/) *(coming soon!)*

---

## 💡 Contributing

Feedback, questions, and suggestions are welcome — especially if you’ve hit real-world storage problems in Node apps before.

---

## 🧾 License

MIT — use it freely, just don’t blame me if your files vanish in a black hole.

---

If you like, I can also help you:
- write a crisp `package.json` `description` and keywords for npm,
- prepare badges for GitHub (build, coverage, license),
- and write an installation section.

Want me to draft those too?