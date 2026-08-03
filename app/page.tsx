"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./lib/supabase";

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      alert("Email aur password dono likho.");
      return;
    }

    setLoading(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      setLoading(false);
      alert(loginError.message);
      return;
    }

    const { error: invitationError } = await supabase.rpc(
      "accept_my_team_invitation"
    );

    if (invitationError) {
      const message = invitationError.message.toLowerCase();

      const expectedError =
        message.includes("pending invitation not found") ||
        message.includes("already belongs to a company");

      if (!expectedError) {
        setLoading(false);
        alert(invitationError.message);
        return;
      }
    }

    setLoading(false);
    router.replace("/dashboard");
  }

  async function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter" && !loading) {
      await handleLogin();
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-700 px-4">
      <div className="w-full max-w-[400px] rounded-2xl bg-white p-10 shadow-2xl">
        <h1 className="mb-2 text-center text-3xl font-bold">
          Accounting SaaS
        </h1>

        <p className="mb-6 text-center text-sm text-gray-500">
          Login to your company workspace
        </p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="email"
          className="mb-4 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="current-password"
          className="mb-6 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
        />

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 p-3 text-white disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {loading ? "Please wait..." : "Login"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/signup")}
          disabled={loading}
          className="mt-3 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-700 disabled:cursor-not-allowed"
        >
          Create New Account
        </button>
      </div>
    </main>
  );
}