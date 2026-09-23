import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { DB } from "../../prisma/db/prisma.db.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
    },
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value?.toLowerCase();

        if (!email) {
          return done(new Error("Google account does not have an email"));
        }

        // 1. Find user by Google ID
        let user = await DB.user.first({ googleId: profile.id });

        if (user) {
          return done(null, user);
        }

        // 2. Check if email already exists — link the account
        const existingUser = await DB.user.first({ email });

        if (existingUser) {
          user = await DB.user.where({ id: existingUser.id }).update({
            googleId: profile.id,
            authProvider: "google",
            emailVerified: true,
          });

          return done(null, user ?? false);
        }

        // 3. Create new user (now correctly reachable — runs when no match at all)
        user = await DB.user.create({
          data: {
            email,
            googleId: profile.id,
            name: profile.name?.givenName ?? profile.displayName,
            fullName: profile.displayName,
            avatarUrl: profile.photos?.[0]?.value,
            authProvider: "google",
            emailVerified: true,
          },
        });

        return done(null, user ?? false);
      } catch (error) {
        console.error("Google OAuth error:", error);
        return done(error instanceof Error ? error : new Error("Google authentication failed"));
      }
    }
  )
);

export default passport;