# 🎬 VideoHub — GitHub Pages + Firebase সেটআপ গাইড

রিয়েল-টাইম ভিডিও শেয়ারিং প্ল্যাটফর্ম যেখানে সবার লাইক, ভিউ, ভিডিও একই সাথে আপডেট হয়।

---

## ধাপ ১ — Firebase প্রজেক্ট তৈরি করুন

1. **https://console.firebase.google.com** এ যান
2. **"Add project"** ক্লিক করুন → নাম দিন (যেমন: `my-videohub`)
3. Google Analytics বন্ধ রাখুন → **Create project**

---

## ধাপ ২ — Realtime Database চালু করুন

1. বাম মেনু থেকে **Build → Realtime Database** ক্লিক
2. **"Create Database"** → Location: `us-central1` → **Next**
3. **"Start in test mode"** বেছে নিন → **Enable**

### Security Rules (গুরুত্বপূর্ণ!)
Database Rules ট্যাবে গিয়ে নিচের rules বসান:

```json
{
  "rules": {
    "videos": {
      ".read": true,
      ".write": true
    },
    "users": {
      ".read": true,
      ".write": true
    },
    "userLikes": {
      ".read": true,
      ".write": true
    }
  }
}
```
**Publish** করুন।

---

## ধাপ ৩ — Web App যোগ করুন ও Config নিন

1. Project Overview → **"</> Web"** ক্লিক করুন
2. App nickname দিন → **Register app**
3. নিচের মতো `firebaseConfig` কপি করুন:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "my-videohub.firebaseapp.com",
  databaseURL: "https://my-videohub-default-rtdb.firebaseio.com",
  projectId: "my-videohub",
  storageBucket: "my-videohub.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

4. **`src/firebase.js`** ফাইল খুলুন এবং `YOUR_API_KEY` ইত্যাদি replace করুন।

---

## ধাপ ৪ — GitHub Repository তৈরি করুন

1. **https://github.com/new** এ নতুন repo তৈরি করুন
2. Repository নাম মনে রাখুন (যেমন: `videohub`)
3. **`vite.config.js`** এ `base: "/videohub/"` — আপনার repo নামে পরিবর্তন করুন

---

## ধাপ ৫ — GitHub Pages চালু করুন

1. Repository → **Settings → Pages**
2. Source: **"GitHub Actions"** বেছে নিন
3. Save করুন

---

## ধাপ ৬ — কোড Push করুন

```bash
git init
git add .
git commit -m "🚀 Initial VideoHub deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/videohub.git
git push -u origin main
```

Push হওয়ার ২-৩ মিনিট পর **Actions** ট্যাবে build সম্পন্ন হবে।

---

## ✅ আপনার সাইট Live!

`https://YOUR_USERNAME.github.io/videohub/` — এই URL-এ সাইট পাওয়া যাবে।

---

## রিয়েল-টাইম ফিচার সমূহ

| ফিচার | কীভাবে কাজ করে |
|-------|----------------|
| 👁️ ভিউ কাউন্ট | প্রথমবার ভিডিও play করলেই +1 |
| ❤️ লাইক | তাৎক্ষণিক সব ব্যবহারকারীর স্ক্রিনে আপডেট |
| 🎬 নতুন ভিডিও | যোগ হওয়ার সাথে সাথে সবাই দেখতে পাবে |
| 👤 ব্যবহারকারী | নতুন মেম্বার রেজিস্ট্রেশন সবার কাছে দেখা যাবে |

---

## সমস্যা হলে

- **Build fail?** `vite.config.js` এ `base` ঠিক আছে কিনা দেখুন
- **ডেটা দেখাচ্ছে না?** Firebase Database URL ঠিক আছে কিনা দেখুন
- **PERMISSION_DENIED?** Firebase Security Rules আবার confirm করুন
