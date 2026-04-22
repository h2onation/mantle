"use client";

import { useEffect, useState, type FormEvent } from "react";

const AUTH_KEY = "sillygoose.unlocked";
const PASSWORD = "whosebh";

export default function SillyGoosePage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    setAuthed(typeof window !== "undefined" && localStorage.getItem(AUTH_KEY) === "ok");
  }, []);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (entered.trim().toLowerCase() === PASSWORD) {
      localStorage.setItem(AUTH_KEY, "ok");
      setAuthed(true);
    } else {
      setError(true);
    }
  }

  if (authed === null) return null;

  if (!authed) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-[#f7f7f7] font-mono text-[#333]">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-xs flex flex-col gap-4 p-6 border border-[#8a8a8a] bg-white"
        >
          <div className="text-sm font-bold tracking-wider">SILLY GOOSE SUMMIT</div>
          <label className="text-xs text-[#555] flex flex-col gap-1">
            Boarding pass required
            <input
              autoFocus
              type="password"
              value={entered}
              onChange={(e) => {
                setEntered(e.target.value);
                setError(false);
              }}
              className="border border-[#8a8a8a] bg-[#f7f7f7] px-2 py-1 font-mono text-sm"
              placeholder="password"
            />
          </label>
          {error && <div className="text-xs text-[#a33]">not on the manifest</div>}
          <button type="submit" className="border border-[#333] bg-[#333] text-white px-2 py-1 text-xs font-mono">
            Board
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f7f7f7]">
      <iframe
        src="/sillygoose.html"
        title="Silly Goose Summit"
        className="block w-full h-dvh border-0"
      />
    </main>
  );
}
