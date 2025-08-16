// at top:
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

// inside component, near the top:
const supa = createClientComponentClient();

// inside handleSubmit, before fetch():
const { data: sess } = await supa.auth.getSession();
const accessToken = sess?.session?.access_token;
if (!accessToken) {
  setError({ code: "not_logged_in", message: "Please sign in again." });
  setSubmitting(false);
  return;
}

// then change your fetch() call to include the Authorization header:
const res = await fetch("/api/dentists/publish", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`, // <-- add this line
  },
  credentials: "include",
  body: JSON.stringify({ name, phone, city, category, slug, publish }),
});
