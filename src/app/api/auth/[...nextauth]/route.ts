import NextAuth from "next-auth";
import Spotify from "next-auth/providers/spotify";
import type { JWT } from "next-auth/jwt";
import type { Profile } from "next-auth";

// Extend the Session interface to include custom properties
declare module "next-auth" {
  interface Session {
    user?: {
      id?: string;
      name?: string;
      email?: string;
      image?: string;
    };
    accessToken?: string;
    error?: string;
  }
}

// Extend the JWT interface to include custom properties
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}

export const authOptions = {
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "user-read-playback-state",
            "user-modify-playback-state",
            "user-read-currently-playing",
            "streaming",
            "user-read-email",
            "user-read-private",
            "playlist-modify-public",
            "playlist-modify-private",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }: { token: JWT; account: any; profile?: Profile }) {
      // Persist the access token to the token right after sign in
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at;
      }
      
      // Add user ID from profile if available
      if (profile) {
        token.id = (profile as any).id;
      }
      
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      // Send properties on the session that comes from the token
      session.accessToken = token.accessToken;
      session.error = token.error;
      
      // Add user ID to session
      if (token.id) {
        session.user = {
          ...session.user,
          id: token.id,
        };
      }
      
      return session;
    },
    async signIn({ user, account, profile }: { user: any; account: any; profile?: any }) {
      // Store user credentials in the users table when they sign in
      if (account && account.provider === 'spotify') {
        const { supabase } = await import('@/lib/supabase');
        
        // Create or update the user record with Spotify credentials
        const { error } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            provider: account.provider,
            provider_id: account.providerAccountId,
            name: user.name,
            image: user.image
          });
          
        if (error) {
          console.error('Error upserting user credentials:', error);
        } else {
          console.log('Successfully upserted user credentials for:', user.email);
        }
      }
      
      return true; // Allow sign in
    },
  },
  pages: {
    signIn: "/",
  },
};



const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };