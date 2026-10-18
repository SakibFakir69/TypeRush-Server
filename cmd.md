npx prisma contract emit
npx prisma migration plan --name add_contest_participants
npx prisma db migrate




===
{
    "success": true,
    "message": "User created. Please verify your email.",
    "data": {
        "age": 25,
        "authProvider": "local",
        "avatarUrl": "https://example.com/avatars/sakib.png",
        "bio": "Indie developer building test data.",
        "country": "Bangladesh",
        "createdAt": "2026-10-16T10:42:14.897829Z",
        "email": "admin2@example.com",
        "emailVerified": false,
        "fullName": "Sakib Hasan",
        "googleId": null,
        "id": "df50a72a-fdd3-469b-9bfa-22b85db9ca6a",
        "isDelete": false,
        "name": "Sakib",
        "role": "USER",
        "updatedAt": "2026-10-16T10:42:14.89Z"
    }
}

====

{
  "name": "Sakib",
  "fullName": "Sakib Hasan",
  "age": 25,
  "email": "user@example.com",
  "password": "hashed_or_plain_test_pw",
  "country": "Bangladesh",
  "googleId": null,
  "authProvider": "local",
  "emailVerified": false,
  "avatarUrl": "https://example.com/avatars/sakib.png",
  "bio": "Indie developer building test data.",
  "role": "USER",
  "isDelete": false
}