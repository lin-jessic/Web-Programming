# Firebase Firestore setup for Stamp Studio

This version uses Firebase Firestore so accounts, My Storage, Community Wall posts, likes, favorites, comments, and replies can be shared across devices.

## Required after deploying

1. Open Firebase Console for the project in `.firebaserc`.
2. Enable **Cloud Firestore**.
3. Start Firestore in production mode or test mode.
4. Add these demo rules in **Firestore Database > Rules**, then publish.

> These rules are for a class/demo project. They allow public read/write for the Stamp Studio collections. Do not use them for private production data.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /stampStudioUsers/{docId} {
      allow read, write: if true;
    }

    match /stampStudioGallery/{docId} {
      allow read, write: if true;
    }

    match /stampStudioGeneralComments/{docId} {
      allow read, write: if true;
    }

    match /stampStudioUserWorks/{userId}/items/{itemId} {
      allow read, write: if true;
    }
  }
}
```

## Deploy again

```bash
cd stamp-studio-online
npm install
npm run build
firebase deploy --only hosting
```

## Important notes

- On Firebase Hosting, the app reads Firebase config from `/__/firebase/init.json` automatically.
- On `npm run dev` or `npm run preview`, Firebase cloud sync may fall back to browser-only local data because `/__/firebase/init.json` only exists on Firebase Hosting.
- If Firestore is not enabled or rules do not allow access, accounts and Community Wall will fall back to local demo mode and other devices will not see the same data.
