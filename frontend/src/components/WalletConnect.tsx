import { Terminal } from 'lucide-react';

export function WalletConnect() {
  return (
    <button
      type="button"
      className="bg-cyan-600 hover:bg-cyan-500 text-white font-mono inline-flex items-center rounded-md px-4 py-2"
    >
      <Terminal className="mr-2 h-4 w-4" />
      Enter Terminal
    </button>
  );
}
