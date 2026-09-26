import { ChevronRight, KeyRound, Leaf, ShieldCheck } from "lucide-react";

export function PrivacySettings({ onMemory }: { onMemory: () => void }) {
  return (
    <div className="settings-panel privacy-panel">
      <section>
        <ShieldCheck size={22} strokeWidth={1.6} />
        <div>
          <h3>Your data stays here.</h3>
          <p>Everything lives in this browser. Nothing is synced.</p>
        </div>
      </section>
      <section>
        <KeyRound size={22} strokeWidth={1.6} />
        <div>
          <h3>Keys are never saved.</h3>
          <p>API keys last for this tab only and are left out of backups.</p>
        </div>
      </section>
      <section>
        <Leaf size={22} strokeWidth={1.6} />
        <div>
          <h3>You choose what’s shared.</h3>
          <p>
            Spins include memory only when it’s on, and journal entries only
            when you share them.
          </p>
          <button className="text-button" onClick={onMemory}>
            Memory settings <ChevronRight size={15} />
          </button>
        </div>
      </section>
    </div>
  );
}
