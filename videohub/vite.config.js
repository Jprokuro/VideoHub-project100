import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ⚠️ "videohub" কে আপনার GitHub repository নামে replace করুন
export default defineConfig({
  plugins: [react()],
  base: "/videohub/",   // ← আপনার repo নাম দিন (e.g. "/my-repo/")
});
