export type GoogleProfile = {
  name: string;
  email: string;
  picture?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (resp: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

function loadGis(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google sign-in is browser-only."));
  }
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load Google.")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google."));
    document.head.appendChild(script);
  });
}

export function hasGoogleClientId() {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
}

/** Opens Google's account picker and consent screen (email + profile). */
export async function requestGoogleProfile(): Promise<GoogleProfile> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    const err = new Error("MISSING_CLIENT_ID");
    err.name = "MISSING_CLIENT_ID";
    throw err;
  }

  await loadGis();
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google sign-in failed to initialize.");
  }

  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      prompt: "consent",
      callback: async (resp) => {
        if (!resp.access_token) {
          reject(
            new Error(
              resp.error_description ||
                resp.error ||
                "Google sign-in was cancelled."
            )
          );
          return;
        }
        try {
          const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          });
          if (!res.ok) throw new Error("Could not read your Google profile.");
          const profile = await res.json();
          if (!profile.email) throw new Error("Google did not share an email address.");
          resolve({
            name: profile.name || String(profile.email).split("@")[0],
            email: profile.email,
            picture: profile.picture,
          });
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Could not finish Google sign-in."));
        }
      },
    });
    client.requestAccessToken();
  });
}
